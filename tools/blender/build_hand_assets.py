"""Build game hand assets from the upstream Yeah Hand STLs.

Source: https://github.com/opsobot/yeah-hand release v1.3
        (Hierarchic STLs, CERN-OHL-S-2.0)

Bakes the game frame into each mesh so the runtime needs no scaling:
    game = (raw_x * S, raw_z * S, raw_y * S)
where S = 3.13 scales the real hand up for VR. The map is a mirror plus a
-90 degree turn about X, which is what the shipping assets already use; it
reproduces the in-engine bounds exactly, so placement code is unchanged.
Exported vertices, `parts.json` anchors and the runtime all share this one
frame, so nothing has to be re-mirrored when the mesh loads.

Each screw anchor is snapped to the nearest point on the decimated surface,
so an anchor can never float off its part.

Usage:
    blender --background --python tools/blender/build_hand_assets.py
"""

import bpy
import json
import os
from mathutils import Matrix, Vector

S = 0.00313
SRC = os.environ.get(
    'YEAH_HAND_STL_DIR',
    '/home/user/Projects/yeah-hand-assets/stls/Hierarchic STLs',
)
ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..'))
OUT_MODELS = os.path.join(ROOT, 'public', 'models', 'hand')
OUT_JSON = os.path.join(OUT_MODELS, 'parts.json')

# raw_z * S + 1.4949 puts the assembled hand where the game expects it,
# so each part's target stays HAND_ROOT + local.
PARTS = [
    {'id': 'palm', 'file': '(LS) Palm.stl', 'budget': 1200,
     'face': (0, -1, 0), 'grid': (2, 2)},
    {'id': 'finger', 'file': 'Fingers/Index Phalanges.stl', 'budget': 700,
     'face': (0, 0, -1), 'grid': (1, 1)},
    {'id': 'thumb-base', 'file': '(LS) Thumb Base.stl', 'budget': 600,
     'face': (-1, 0, 0), 'grid': (1, 1)},
    {'id': 'thumb-segments', 'file': 'Fingers/Thumb Phalanges.stl',
     'budget': 1800, 'face': (0, -1, 0), 'grid': (1, 1)},
    {'id': 'upper-cover', 'file': 'Covers/(LS) Upper Cover.stl', 'budget': 500,
     'face': (0, 0, 1), 'grid': (2, 2)},
]

GAME_FRAME = (Matrix.Diagonal((1.0, 1.0, -1.0, 1.0)) @
              Matrix.Rotation(-1.5707963267948966, 4, 'X'))


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def face_anchors(obj, face, grid):
    """Pick screw sites from faces that actually point the intended way.

    Anchors come from the mesh's own polygons, so they are on the surface and
    correctly oriented by construction; farthest-point selection then spreads
    them out. Bounding-box guessing was tried and it kept landing screws on
    side walls or collapsing them onto one another.
    """
    axis = Vector(face).normalized()
    want = grid[0] * grid[1]
    polys = obj.data.polygons
    for threshold in (0.85, 0.6, 0.25):
        candidates = [(p.center.copy(), p.normal.copy())
                      for p in polys if p.normal.dot(axis) >= threshold]
        if len(candidates) >= want:
            break
    if not candidates:
        return []

    if want == 1:
        centroid = sum((c[0] for c in candidates), Vector()) / len(candidates)
        point, normal = min(
            candidates, key=lambda c: (c[0] - centroid).length)
        return [(point, normal.normalized(), 'facet')]

    chosen = [candidates[0]]
    while len(chosen) < want:
        best = None
        best_distance = -1.0
        for item in candidates:
            distance = min((item[0] - pick[0]).length for pick in chosen)
            if distance > best_distance:
                best_distance = distance
                best = item
        if best is None or best_distance < 0.003:
            break
        chosen.append(best)
    return [(point, normal.normalized(), 'facet') for point, normal in chosen]


def build_part(spec):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = os.path.join(SRC, spec['file'])
    bpy.ops.wm.stl_import(filepath=path)
    obj = bpy.context.selected_objects[0]
    raw_tris = tri_count(obj)

    obj.matrix_world = GAME_FRAME @ Matrix.Diagonal((S, S, S, 1.0))
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    mod = obj.modifiers.new('decimate', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = min(1.0, spec['budget'] / float(raw_tris))
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    tris = tri_count(obj)

    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.uv.smart_project(angle_limit=1.1519, island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')

    # Faces are written in the same frame as the exported vertices, so the
    # anchor aim needs no adjustment.
    axis = Vector(spec['face']).normalized()
    anchors = []
    for location, hit_normal, how in face_anchors(
            obj, spec['face'], spec['grid']):
        anchors.append({
            'point': [round(v, 5) for v in location],
            'normal': [round(v, 4) for v in hit_normal],
            'aim': round(axis.dot(hit_normal), 2),
            'how': how,
        })
        empty = bpy.data.objects.new(f'screw.{spec["id"]}.{len(anchors) - 1}',
                                     None)
        bpy.context.scene.collection.objects.link(empty)
        empty.location = location
        empty.rotation_mode = 'QUATERNION'
        empty.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(
            hit_normal)

    obj.name = f'part:{spec["id"]}'
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    glb = os.path.join(OUT_MODELS, f'{spec["id"]}.glb')
    bpy.ops.export_scene.gltf(
        filepath=glb,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=False,
        export_normals=True,
        export_texcoords=True,
    )

    obj.data.calc_loop_triangles()
    bbox = [Vector(c) for c in obj.bound_box]
    lo = [round(min(v[i] for v in bbox), 4) for i in range(3)]
    hi = [round(max(v[i] for v in bbox), 4) for i in range(3)]

    print(f'PART|{spec["id"]}|raw={raw_tris}|tris={tris}'
          f'|kb={os.path.getsize(glb) // 1024}'
          f'|anchors={len(anchors)}')
    for a in anchors:
        print(f'  SNAP|{a["point"]}|aim={a["aim"]}|how={a["how"]}'
              f'|normal={a["normal"]}')
    return obj, {
        'id': spec['id'],
        'glb': f'{spec["id"]}.glb',
        'tris': tris,
        'anchors': anchors,
        'bbox': {'min': lo, 'max': hi},
    }


def main():
    os.makedirs(OUT_MODELS, exist_ok=True)
    entries = {}
    for spec in PARTS:
        _obj, entry = build_part(spec)
        entries[spec['id']] = entry

    payload = {
        'generatedBy': 'tools/blender/build_hand_assets.py',
        'source': 'opsobot/yeah-hand v1.3 Hierarchic STLs',
        'licence': 'CERN-OHL-S-2.0',
        'scale': S,
        'parts': entries,
    }
    with open(OUT_JSON, 'w', encoding='utf-8') as handle:
        json.dump(payload, handle, indent=2)
        handle.write('\n')
    total = sum(e['tris'] for e in entries.values())
    print(f'WROTE|{OUT_JSON}|parts={len(entries)}|tris={total}')


main()
