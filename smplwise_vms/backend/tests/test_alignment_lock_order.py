"""Original SQLite WriteGate + journal, provided conn against connectionless proof."""
from contextlib import contextmanager
from pathlib import Path
import sys,threading
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"arx-candidate/smplwise_vms/backend"))
from smplwise.db import Database
from smplwise.services import wiskey_install_generation as gen

def test_provided_writer_and_connectionless_proof_have_one_lock_order(tmp_path,monkeypatch):
 db=Database(tmp_path/"db/smplwise.db");db.migrate();attempt=threading.Event();errors=[]
 original=db.write_aside
 @contextmanager
 def observe(*a,**kw):
  if threading.current_thread().name=="connectionless-proof":attempt.set()
  with original(*a,**kw) as conn:yield conn
 monkeypatch.setattr(db,"write_aside",observe)
 with db.connection(label="provided installation writer") as conn:
  generation=gen.begin(db,conn,"synthetic-digest")
  def proof():
   try:gen.record_proof(db,generation,"reconcile","ready")
   except BaseException as exc:errors.append(type(exc).__name__+":"+str(exc))
  t=threading.Thread(target=proof,name="connectionless-proof");t.start()
  assert attempt.wait(2)
  claim=gen.claim_restart(db,conn,generation,"synthetic-digest")
  assert claim
 t.join(15);assert not t.is_alive();assert errors==[]
 journal=gen.read(db);assert journal["claim"]==claim and journal["proof"]["outcome"]=="ready"
