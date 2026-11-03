"""Separate TEST-only lease replay metadata; no legacy journal migration."""
import sqlite3,tempfile
from pathlib import Path
from .validation import Refusal

class LeaseReplay:
    def __init__(self, directory, *, in_memory=False, capacity=4096):
        if type(directory) is not tempfile.TemporaryDirectory or type(in_memory) is not bool or type(capacity) is not int or not 1<=capacity<=4096:
            raise ValueError('bounded explicit temporary lease store required')
        root=Path(directory.name);path=root/'lease-experimental-replay.sqlite'
        if root.is_symlink() or not root.is_dir() or path.is_symlink():raise ValueError('temporary lease store required')
        self.capacity,self.closed=capacity,False
        self.db=sqlite3.connect(':memory:' if in_memory else path,isolation_level=None)
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.executescript('CREATE TABLE IF NOT EXISTS observed(id INTEGER PRIMARY KEY CHECK(id=1), at REAL NOT NULL);'
            'CREATE TABLE IF NOT EXISTS identities(kind TEXT NOT NULL,id TEXT NOT NULL,at REAL NOT NULL,PRIMARY KEY(kind,id));'
            'CREATE TABLE IF NOT EXISTS streams(id TEXT PRIMARY KEY);')

    def observe(self, now):
        """Persist the greatest trusted clock even without a signed request."""
        if self.closed:raise Refusal("binding_denied")
        self.db.execute("BEGIN IMMEDIATE")
        try:
            previous=self.db.execute("SELECT at FROM observed WHERE id=1").fetchone()
            if previous and now.timestamp()<previous[0]:raise Refusal("binding_denied")
            self.db.execute("INSERT INTO observed VALUES(1,?) ON CONFLICT(id) DO UPDATE SET at=excluded.at",(now.timestamp(),))
            self.db.execute("COMMIT")
        except BaseException:
            if self.db.in_transaction:self.db.execute("ROLLBACK")
            raise

    def reserve(self, request_id, nonce, now):
        if self.closed:raise Refusal('binding_denied')
        self.db.execute('BEGIN IMMEDIATE')
        try:
            previous=self.db.execute('SELECT at FROM observed WHERE id=1').fetchone()
            if previous and now.timestamp()<previous[0]:raise Refusal('binding_denied')
            self.db.execute('INSERT INTO observed VALUES(1,?) ON CONFLICT(id) DO UPDATE SET at=excluded.at',(now.timestamp(),))
            self.db.execute('DELETE FROM identities WHERE at<=?',(now.timestamp()-7*86400,))
            duplicate=any(self.db.execute('SELECT 1 FROM identities WHERE kind=? AND id=?',(kind,value)).fetchone() for kind,value in (('request',request_id),('nonce',nonce)))
            full=self.db.execute('SELECT COUNT(*) FROM identities').fetchone()[0]+2>2*self.capacity
            if duplicate or full:
                self.db.execute('COMMIT')  # retain the trusted maximum even on refusal
                raise Refusal('unproven_duplicate' if duplicate else 'binding_denied')
            self.db.executemany('INSERT INTO identities VALUES(?,?,?)',[(kind,value,now.timestamp()) for kind,value in (('request',request_id),('nonce',nonce))])
            self.db.execute('COMMIT')
        except BaseException:
            if self.db.in_transaction:self.db.execute('ROLLBACK')
            raise

    def remember_stream(self, stream):
        if self.closed:raise Refusal('binding_denied')
        self.db.execute('BEGIN IMMEDIATE')
        try:
            if self.db.execute('SELECT 1 FROM streams WHERE id=?',(stream,)).fetchone():raise Refusal('unproven_duplicate')
            if self.db.execute('SELECT COUNT(*) FROM streams').fetchone()[0]>=self.capacity:raise Refusal('binding_denied')
            self.db.execute('INSERT INTO streams VALUES(?)',(stream,));self.db.execute('COMMIT')
        except BaseException:
            if self.db.in_transaction:self.db.execute('ROLLBACK')
            raise
    def close(self):
        if not self.closed:self.closed=True;self.db.close()
