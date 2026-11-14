"""Build game hand assets in Blender.

Source for the printed parts:
    https://github.com/opsobot/yeah-hand release v1.3
    (Hierarchic STLs, CERN-OHL-S-2.0)

The five printed parts come from the upstream STLs; the bought-in parts
(servo, wrist plate, pins, hinge boss, knuckle cap) are modelled below.
Everything is baked into the game frame so the runtime needs no scaling:
    game = (raw_x * S, raw_z * S, raw_y * S)
where S = 3.13 scales the real hand up for VR. Exported vertices,
`parts.json` anchors and the runtime all share this one frame, so nothing
has to be re-mirrored when a mesh loads.

Every screw anchor is a point on the exported surface with that surface's
own normal, so an anchor can never float off its part.

Usage:
    blender --background --python tools/blender/build_hand_assets.py
"""

import bpy
import json
import math
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
PRINTED_PARTS = [
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


def finish(obj, part_id, raw_tris, make_anchors, budget=None):
    """Decimate, smooth, unwrap, export and describe one part."""
    if budget is not None:
        mod = obj.modifiers.new('decimate', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = min(1.0, budget / float(raw_tris))
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)

    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.uv.smart_project(angle_limit=1.1519, island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')
    tris = tri_count(obj)

    # Anchors are taken from the final surface, so a decimated part cannot
    # leave one floating in the air.
    anchors = make_anchors(obj)

    for index, anchor in enumerate(anchors):
        empty = bpy.data.objects.new(f'screw.{part_id}.{index}', None)
        bpy.context.scene.collection.objects.link(empty)
        empty.location = Vector(anchor['point'])
        empty.rotation_mode = 'QUATERNION'
        empty.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(
            Vector(anchor['normal']))

    obj.name = f'part:{part_id}'
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    glb = os.path.join(OUT_MODELS, f'{part_id}.glb')
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

    print(f'PART|{part_id}|raw={raw_tris}|tris={tris}'
          f'|kb={os.path.getsize(glb) // 1024}'
          f'|anchors={len(anchors)}')
    for anchor in anchors:
        print(f'  SNAP|{anchor["point"]}|aim={anchor["aim"]}'
              f'|how={anchor["how"]}|normal={anchor["normal"]}')
    return {
        'id': part_id,
        'glb': f'{part_id}.glb',
        'tris': tris,
        'anchors': anchors,
        'bbox': {'min': lo, 'max': hi},
    }


def build_printed_part(spec):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = os.path.join(SRC, spec['file'])
    bpy.ops.wm.stl_import(filepath=path)
    obj = bpy.context.selected_objects[0]
    raw_tris = tri_count(obj)

    obj.matrix_world = GAME_FRAME @ Matrix.Diagonal((S, S, S, 1.0))
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Faces are written in the same frame as the exported vertices, so the
    # anchor aim needs no adjustment.
    axis = Vector(spec['face']).normalized()

    def make_anchors(mesh):
        return [
            {
                'point': [round(v, 5) for v in location],
                'normal': [round(v, 4) for v in normal.normalized()],
                'aim': round(axis.dot(normal.normalized()), 2),
                'how': how,
            }
            for location, normal, how in face_anchors(
                mesh, spec['face'], spec['grid'])
        ]

    return finish(obj, spec['id'], raw_tris, make_anchors, spec['budget'])


def material(name, rgb, metallic=0.0, roughness=0.55):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


def box(size, at, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    obj = bpy.context.active_object
    obj.scale = size
    bpy.ops.object.transform_apply(
        location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


def disk(radius, depth, at, mat, sides=12, axis='Z'):
    rotation = {
        'Z': (0.0, 0.0, 0.0),
        'X': (0.0, math.pi / 2, 0.0),
        'Y': (math.pi / 2, 0.0, 0.0),
    }[axis]
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=sides,
        radius=radius,
        depth=depth,
        location=at,
        rotation=rotation,
    )
    obj = bpy.context.active_object
    bpy.ops.object.transform_apply(
        location=False, rotation=True, scale=True)
    obj.data.materials.append(mat)
    return obj


def merge(objects, name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def snap_anchors(obj, specs):
    """Put each designed screw site on the nearest real surface."""
    anchors = []
    for spec in specs:
        _hit, location, _normal, index = obj.closest_point_on_mesh(
            Vector(spec['at']))
        face = obj.data.polygons[index].normal.normalized()
        axis = Vector(spec['face']).normalized()
        anchors.append({
            'point': [round(v, 5) for v in location],
            'normal': [round(v, 4) for v in face],
            'aim': round(axis.dot(face), 2),
            'how': 'snap',
        })
    return anchors


def build_servo():
    body = material('servoBody', (0.055, 0.065, 0.08), 0.0, 0.5)
    steel = material('servoSteel', (0.52, 0.54, 0.58), 0.85, 0.35)
    seam = material('servoSeam', (0.02, 0.025, 0.03), 0.0, 0.7)
    parts = [
        box((0.05, 0.10, 0.03), (0, 0, 0), body),
        box((0.034, 0.04, 0.008), (0, 0.014, -0.018), steel),
        box((0.05, 0.09, 0.016), (0, 0, 0.025), steel),
        box((0.041, 0.06, 0.002), (0, -0.006, 0), seam),
        box((0.024, 0.024, 0.01), (0, 0.01, -0.024), steel),
        disk(0.008, 0.008, (0, 0.025, -0.025), steel, 12, 'Z'),
        box((0.03, 0.008, 0.005), (0.008, 0.025, -0.03), steel),
        disk(0.002, 0.008, (0, 0.025, -0.034), steel, 8, 'Z'),
    ]
    for side in (-1, 1):
        parts.append(
            box((0.03, 0.018, 0.006), (side * 0.04, -0.055, -0.015), steel))
        parts.append(disk(
            0.004, 0.008, (side * 0.04, -0.055, -0.015), seam, 10, 'Z'))
    for index, rgb in enumerate(((0.45, 0.1, 0.07), (0.05, 0.06, 0.07),
                                 (0.6, 0.42, 0.06))):
        wire = material(f'servoWire{index}', rgb, 0.0, 0.7)
        parts.append(disk(
            0.0015, 0.055, (-0.018 + index * 0.018, -0.072, 0), wire, 8, 'Y'))
    obj = merge(parts, 'servo')
    return obj, [
        {'at': (0, 0, -0.015), 'face': (0, 0, -1)},
    ]


def build_wrist_plate():
    printed = material('printed', (0.54, 0.6, 0.48))
    obj = merge([
        box((0.17, 0.026, 0.105), (0, 0, 0), printed),
        disk(0.0425, 0.02, (0, 0.018, 0), printed, 20, 'Y'),
    ], 'wrist-plate')
    return obj, [
        {'at': (0.06, 0.013, 0), 'face': (0, 1, 0)},
        {'at': (-0.06, 0.013, 0), 'face': (0, 1, 0)},
    ]


def build_pin(length):
    printed = material('printed', (0.54, 0.6, 0.48))
    parts = [disk(0.006, length, (0, 0, 0), printed, 12, 'X')]
    for side in (-1, 1):
        parts.append(disk(
            0.009, 0.006, (side * length / 2, 0, 0), printed, 12, 'X'))
    obj = merge(parts, 'pin')
    return obj, []


def build_hinge_boss():
    printed = material('printed', (0.54, 0.6, 0.48))
    obj = merge([
        disk(0.019, 0.034, (0, 0, 0), printed, 14, 'X'),
        disk(0.026, 0.008, (0.018, 0, 0), printed, 14, 'X'),
    ], 'hinge-boss')
    return obj, []


def build_knuckle_cap():
    printed = material('printed', (0.54, 0.6, 0.48))
    obj = merge([
        disk(0.014, 0.012, (0, 0, 0), printed, 16, 'Z'),
        disk(0.0065, 0.006, (0, 0, 0.007), printed, 12, 'Z'),
    ], 'knuckle-cap')
    return obj, [
        {'at': (0, 0, 0.01), 'face': (0, 0, 1)},
    ]


def build_simple_part(spec):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    obj, anchor_specs = spec['build']()
    raw_tris = tri_count(obj)
    return finish(
        obj, spec['id'], raw_tris, lambda mesh: snap_anchors(
            mesh, anchor_specs))


HARD_PARTS = [
    {'id': 'servo', 'build': build_servo},
    {'id': 'wrist-plate', 'build': build_wrist_plate},
    {'id': 'pin', 'build': lambda: build_pin(0.057)},
    {'id': 'thumb-pin', 'build': lambda: build_pin(0.048)},
    {'id': 'hinge-boss', 'build': build_hinge_boss},
    {'id': 'knuckle-cap', 'build': build_knuckle_cap},
]


def main():
    os.makedirs(OUT_MODELS, exist_ok=True)
    entries = {}
    for spec in PRINTED_PARTS:
        entries[spec['id']] = build_printed_part(spec)
    for spec in HARD_PARTS:
        entries[spec['id']] = build_simple_part(spec)

    payload = {
        'generatedBy': 'tools/blender/build_hand_assets.py',
        'source': 'opsobot/yeah-hand v1.3 Hierarchic STLs (printed parts)',
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
