#!/usr/bin/env python3
import json
from pathlib import Path
import subprocess
from artifact import ROOT, read_config, guard, validate_artifact, verify_live, json_bytes
MAX_PREVIEW_OUTPUT_BYTES=2*1024*1024

def parse_preview_output(raw, *, expected_name="develop"):
    """Parse one final JSON object after Wrangler's human asset-upload log."""
    assert isinstance(raw,str) and len(raw.encode('utf-8'))<=MAX_PREVIEW_OUTPUT_BYTES,'Preview output exceeds the bounded reporting limit'
    first=re.search(r'(?m)^[ \t]*([\{\[])',raw)
    assert first,'Wrangler did not emit a final Preview JSON object'
    try:data,end=json.JSONDecoder().raw_decode(raw,first.start(1))
    except json.JSONDecodeError as error:raise ValueError('Malformed final Wrangler Preview JSON') from error
    assert not raw[end:].strip(),'Unexpected trailing output or multiple JSON payloads'
    assert isinstance(data,dict) and set(data)=={'preview','deployment'},'Unexpected final Preview report schema'
    preview,deployment=data['preview'],data['deployment']
    assert isinstance(preview,dict) and isinstance(deployment,dict)
    assert isinstance(preview.get('id'),str) and re.fullmatch(r'[a-f0-9]{32}',preview['id'])
    assert preview.get('name')==expected_name and preview.get('slug')==expected_name
    assert isinstance(deployment.get('id'),str) and re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',deployment['id'])
    assert isinstance(deployment.get('number'),int) and deployment['number']>=0
    assert isinstance(deployment.get('created_on'),str) and deployment['created_on']
    assert isinstance(deployment.get('main_module'),str) and deployment['main_module']
    assert isinstance(deployment.get('annotations'),dict)
    for item in (preview,deployment):
        assert isinstance(item.get('urls'),list) and item['urls']
        assert all(isinstance(url,str) and url.startswith('https://') for url in item['urls'])
    # Empty env may be omitted by this API. Absence is NOT a binding readback.
    if 'env' in deployment:assert deployment['env']=={},'Unexpected Preview runtime variables, secrets or bindings'
    return data


sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
c=read_config();guard(c,'develop',sha);directory=ROOT/'.cloudflare-site'
validate_artifact(c,'develop',sha,directory)
raw=ROOT/'.cloudflare-preview-result.json';assert raw.stat().st_size<=MAX_PREVIEW_OUTPUT_BYTES
result=parse_preview_output(raw.read_text())
verified=verify_live(c,'develop',sha,directory)
receipt={'status':'passed','repository':c['repository'],'sourceCommit':sha,'branch':'develop','preview':result,'verification':verified,'productionDeployInvoked':False,'runtimeBindingReadbackClaimed':False}
(ROOT/'.cloudflare-preview-receipt.json').write_bytes(json_bytes(receipt))
print(json.dumps(receipt,sort_keys=True))
