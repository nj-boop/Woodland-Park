"""Convert Blender's .glb exports into self-contained .gltf JSON files (saved as .json).

The artifact host only serves standard web file types, and .json is one of them, so models ship
as JSON with the binary buffer embedded as base64. GLTFLoader reads them unchanged.

Usage: python3 tools/glb-to-json.py <dir-with-glb-files> <output-dir>
"""
import base64, json, os, struct, sys

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for name in sorted(os.listdir(src)):
    if not name.endswith('.glb'):
        continue
    data = open(os.path.join(src, name), 'rb').read()
    json_len = struct.unpack('<I', data[12:16])[0]
    doc = json.loads(data[20:20 + json_len])
    off = 20 + json_len
    bin_len = struct.unpack('<I', data[off:off + 4])[0]
    doc['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(data[off + 8:off + 8 + bin_len]).decode()
    target = os.path.join(out, name[:-4] + '.json')
    with open(target, 'w') as f:
        json.dump(doc, f, separators=(',', ':'))
    print(f'{name} -> {os.path.basename(target)} ({os.path.getsize(target) // 1024} KB)')
