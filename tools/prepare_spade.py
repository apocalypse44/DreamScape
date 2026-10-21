"""Bundle only Spade's selected modules; downsample shared source textures to 256px.

Run after extracting the three free packs into assets/. Requires Pillow.
No downloaded source assets are modified. Outputs are selected GLBs and shared textures.
"""
import io
import json
import pathlib
import struct
import hashlib
import shutil
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'assets'
OUT = ASSETS / 'spade'
MODULES = {
    'tower': 'kenney_castle-kit/Models/GLB format/tower-square-mid-windows.glb',
    'crown': 'kenney_castle-kit/Models/GLB format/tower-square-top.glb',
    'spire': 'kenney_castle-kit/Models/GLB format/tower-square-roof.glb',
    'wall': 'kenney_castle-kit/Models/GLB format/wall.glb',
    'roof': 'Medieval Village MegaKit[Standard]/glTF/Roof_RoundTiles_4x6.gltf',
    'window': 'Medieval Village MegaKit[Standard]/glTF/Wall_Plaster_Window_Wide_Flat.gltf',
    'chimney': 'Medieval Village MegaKit[Standard]/glTF/Prop_Chimney.gltf',
    'pillar': 'KayKit_Dungeon_Pack_1.1_FREE/Assets/gltf/pillar_decorated.gltf',
    'torch': 'KayKit_Dungeon_Pack_1.1_FREE/Assets/gltf/torch_lit.gltf',
    'chest': 'KayKit_Dungeon_Pack_1.1_FREE/Assets/gltf/chest.gltf',
}


def prepare():
    OUT.mkdir(exist_ok=True)
    for name, relative in {
        'Kenney-CC0.txt': 'kenney_castle-kit/License.txt',
        'Quaternius-CC0.txt': 'Medieval Village MegaKit[Standard]/License_Standard.txt',
        'KayKit-CC0.txt': 'KayKit_Dungeon_Pack_1.1_FREE/License.txt',
    }.items():
        shutil.copy2(ASSETS / relative, OUT / name)
    total = 0
    for name, relative in MODULES.items():
        path = ASSETS / relative
        if path.suffix == '.glb':
            raw = path.read_bytes()
            size, _ = struct.unpack_from('<II', raw, 12)
            doc = json.loads(raw[20:20 + size])
            binary = raw[28 + size:]
        else:
            doc = json.loads(path.read_text())
            binary = (path.parent / doc['buffers'][0]['uri']).read_bytes()
        blob = bytearray(binary[:doc['buffers'][0]['byteLength']])
        # Normal/ORM maps add little to the distant stylized buildings. Keep only
        # base colour/emission and share downsampled atlases across all modules.
        for material in doc.get('materials', []):
            material.pop('normalTexture', None)
            material.pop('occlusionTexture', None)
            pbr = material.setdefault('pbrMetallicRoughness', {})
            pbr.pop('metallicRoughnessTexture', None)
            pbr['roughnessFactor'] = 0.95
            pbr['metallicFactor'] = 0
        used = []
        for material in doc.get('materials', []):
            for container in [material, material['pbrMetallicRoughness']]:
                for key in ['baseColorTexture', 'emissiveTexture']:
                    if key in container:
                        info = container[key]
                        old = info['index']
                        if old not in used:
                            used.append(old)
                        info['index'] = used.index(old)
        textures = [doc.get('textures', [])[i] for i in used]
        images = [dict(doc['images'][tex['source']]) for tex in textures]
        for i, texture in enumerate(textures):
            texture['source'] = i
        doc['textures'], doc['images'] = textures, images
        for image in images:
            if 'uri' in image:
                data = (path.parent / image.pop('uri')).read_bytes()
            else:
                view = doc['bufferViews'][image['bufferView']]
                offset = view.get('byteOffset', 0)
                data = binary[offset:offset + view['byteLength']]
            with Image.open(io.BytesIO(data)) as source:
                source.thumbnail((256, 256), Image.Resampling.LANCZOS)
                output = io.BytesIO()
                source.save(output, format='PNG', optimize=True)
                data = output.getvalue()
            # External shared textures are cached once across every GLB.
            image.pop('bufferView', None)
            image.pop('mimeType', None)
            texture_name = hashlib.sha256(data).hexdigest()[:16] + '.png'
            image['uri'] = texture_name
            (OUT / texture_name).write_bytes(data)
        doc['buffers'] = [{'byteLength': len(blob)}]
        payload = json.dumps(doc, separators=(',', ':')).encode()
        payload += b' ' * (-len(payload) % 4)
        blob.extend(b'\0' * (-len(blob) % 4))
        result = (struct.pack('<III', 0x46546C67, 2, 28 + len(payload) + len(blob))
                  + struct.pack('<II', len(payload), 0x4E4F534A) + payload
                  + struct.pack('<II', len(blob), 0x004E4942) + blob)
        (OUT / f'{name}.glb').write_bytes(result)
        total += len(result)
        print(f'{name}: {len(result):,} bytes')
    texture_bytes = sum(p.stat().st_size for p in OUT.glob('*.png'))
    print(f'Spade: {(total + texture_bytes) / 1024:.0f} KiB including shared textures; loaded on approach')


if __name__ == '__main__':
    prepare()
