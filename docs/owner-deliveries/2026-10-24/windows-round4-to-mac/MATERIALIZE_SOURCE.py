"""Validate and materialize original source bytes. Never imports product code."""
from pathlib import Path, PurePosixPath
import argparse, hashlib, json, os, re, zipfile

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    base=Path(__file__).resolve().parent/'source'
    meta=json.loads((base/'SOURCE_CONTAINER.json').read_text(encoding='utf-8'))
    archive=base/meta['file']
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=meta['sha256']:
        raise ValueError('container SHA256 mismatch')
    if args.output.exists(): raise ValueError('output must be a new directory')
    manifests=[json.loads(p.read_text(encoding='utf-8')) for p in sorted(base.glob('*_MANIFEST.json'))]
    validated=[]
    with zipfile.ZipFile(archive) as z:
        names=z.namelist()
        if len(names)!=len(set(names)) or any(not re.fullmatch(r'sha256/[0-9a-f]{64}',n) for n in names):
            raise ValueError('invalid or duplicate member')
        cache={}
        for m in manifests:
            if m['file_count']!=len(m['files']): raise ValueError('file count mismatch')
            seen=set()
            for f in m['files']:
                path=PurePosixPath(f['path'])
                if path.is_absolute() or '..' in path.parts or '\\' in f['path'] or f['path'] in seen:
                    raise ValueError('unsafe or duplicate path')
                seen.add(f['path'])
                h=f['sha256']
                if h not in cache: cache[h]=z.read('sha256/'+h)
                b=cache[h]
                if len(b)!=f['bytes'] or hashlib.sha256(b).hexdigest()!=h:
                    raise ValueError('source SHA256 mismatch')
                if hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()!=f['git_blob']:
                    raise ValueError('original Git blob mismatch')
                if f['mode'] not in ('100644','100755'):
                    raise ValueError('unsupported source file mode')
                validated.append((m['unit'],m['CODE'],f,b))
        if set(names)!={'sha256/'+h for h in cache}: raise ValueError('unexpected source blobs')
    root=args.output.resolve()
    for unit,code,f,b in validated:
        dest=root/(unit+'-'+code)/f['path']
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(b)
        if f['mode']=='100755': os.chmod(dest,0o755)
    print(json.dumps({'status':'ARCHIVE_VERIFIED','original_files':len(validated),'unique_blobs':len(cache),'CODEs':[m['CODE'] for m in manifests],'product_tests':'NOT_RUN'}))

if __name__=='__main__': main()
