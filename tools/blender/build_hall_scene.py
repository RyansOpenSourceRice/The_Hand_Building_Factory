"""Build one editable Blender scene out of the running game.

`scripts/scene-audit.mjs` writes `qa-out/scene.obj`: every mesh the game
draws, one OBJ group each, in world space. This script imports it, colours
the objects by role, runs triangle-level intersection tests for the pairs
that must never touch (forklift against walls and racks, the conveyor
against the barrier, crates against the shell), and renders a plan view so
the whole layout can be judged at a glance.

Usage:
    blender --background --python tools/blender/build_hall_scene.py -- \
        [qa-out/scene.obj]
"""

import os
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'qa-out')

# Pairs that must never intersect. Left side is a prefix, right side is a
# list of prefixes it is checked against. Colliders are invisible physics
# shapes that overlap everything on purpose, so they are skipped.
WATCH = [
    ('forklift', ['hallWall', 'hallEnd', 'hallColumn', 'warehouseColumn',
                  'warehouseFront', 'warehouseLeft', 'rack', 'arm',
                  'conveyor', 'stage', 'printer', 'palletStack', 'bench']),
    ('conveyor', ['barrierRail', 'hallColumn', 'warehouseColumn',
                  'warehouseFront', 'warehouseLeft', 'stage', 'printer']),
    ('crowd', ['hallColumn', 'warehouseColumn', 'warehouseFront',
               'warehouseLeft', 'stage']),
    ('palletStack', ['hallColumn', 'warehouseColumn', 'warehouseFront',
                     'warehouseLeft', 'rack']),
    ('rack', ['hallColumn', 'warehouseColumn', 'warehouseFront',
              'warehouseLeft']),
]

COLOURS = {
    'forklift': (0.95, 0.62, 0.10, 1.0),
    'conveyor': (0.20, 0.75, 0.70, 1.0),
    'crowd': (0.85, 0.80, 0.25, 1.0),
    'rack': (0.30, 0.45, 0.85, 1.0),
    'load': (0.65, 0.45, 0.25, 1.0),
    'barrier': (0.35, 0.35, 0.40, 1.0),
    'arm': (0.80, 0.30, 0.25, 1.0),
    'part': (0.55, 0.90, 0.55, 1.0),
    'shell': (0.55, 0.57, 0.62, 1.0),
    'stage': (0.45, 0.40, 0.60, 1.0),
    'printer': (0.40, 0.55, 0.65, 1.0),
    'misc': (0.70, 0.70, 0.70, 1.0),
}


def colour_for(name):
    lowered = name.lower()
    if lowered.startswith('part:'):
        return COLOURS['part']
    for key in ('forklift', 'conveyor', 'crowd', 'rack', 'pallet', 'crate',
                'barrier', 'arm', 'printer', 'stage', 'screen', 'podium',
                'ground', 'hall', 'warehouse', 'column', 'beam', 'wall',
                'door', 'light', 'lamp', 'tier', 'chair'):
        if key in lowered:
            if key in ('pallet', 'crate'):
                return COLOURS['load']
            if key in ('ground', 'hall', 'warehouse', 'column', 'beam',
                       'wall', 'door', 'light', 'lamp', 'tier'):
                return COLOURS['shell']
            if key in ('stage', 'screen', 'podium', 'chair'):
                return COLOURS['stage']
            return COLOURS[key]
    return COLOURS['misc']


def clear_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials):
        for entry in list(block):
            block.remove(entry)


def import_obj(path):
    props = bpy.ops.wm.obj_import.get_rna_type().properties.keys()
    kwargs = {'filepath': path}
    if 'use_split_groups' in props:
        # The exporter writes one `g` group per mesh, so splitting on groups
        # is what keeps the meshes separate and keeps their names.
        kwargs['use_split_groups'] = True
        kwargs['use_split_objects'] = True
    bpy.ops.wm.obj_import(**kwargs)
    return [ob for ob in bpy.context.scene.objects if ob.type == 'MESH']


def paint(objects):
    for ob in objects:
        ob.color = colour_for(ob.name)


def tree_for(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.transform(ob.matrix_world)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    return tree


def watch_report(objects):
    usable = [ob for ob in objects
              if len(ob.data.polygons) and 'collider' not in ob.name.lower()]
    trees = {}
    findings = []
    tested = 0
    for left, others in WATCH:
        lefts = [ob for ob in usable if ob.name.lower().startswith(left)]
        for other in others:
            rights = [ob for ob in usable
                      if ob.name.lower().startswith(other)]
            for a in lefts:
                if a.name not in trees:
                    trees[a.name] = tree_for(a)
                for b in rights:
                    if b.name not in trees:
                        trees[b.name] = tree_for(b)
                    tested += 1
                    hits = trees[a.name].overlap(trees[b.name])
                    if hits:
                        findings.append((len(hits), a.name, b.name))
    # A tree that never reports anything would make a clean result meaningless,
    # so prove the overlap test works on one object against itself.
    probe = usable[0]
    self_hits = tree_for(probe).overlap(tree_for(probe))
    print(f'bvh self-test: {len(self_hits)} self overlaps on {probe.name}')
    findings.sort(reverse=True)
    return findings, tested


def render(scene):
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'OBJECT'
    scene.display.shading.show_shadows = True
    scene.render.resolution_x = 1500
    scene.render.resolution_y = 1500
    scene.render.film_transparent = False
    world = bpy.data.worlds.new('BlockoutWorld')
    world.color = (0.16, 0.17, 0.2)
    scene.world = world

    cam_data = bpy.data.cameras.new('BlockoutCam')
    cam = bpy.data.objects.new('BlockoutCam', cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    cam_data.type = 'ORTHO'

    views = [
        ('hall-plan.png', (0, 0, 46), (0, 0, -14), 40),
        ('hall-stage.png', (14, -22, 12), (0, -4, 1), 22),
    ]
    for name, eye, aim, ortho in views:
        cam.location = eye
        look = (Vector(aim) - Vector(eye)).normalized()
        cam.rotation_euler = look.to_track_quat('-Z', 'Y').to_euler()
        cam_data.ortho_scale = ortho
        path = os.path.join(OUT, name)
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print('rendered', path)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    obj = argv[0] if argv else os.path.join(OUT, 'scene.obj')
    clear_scene()
    objects = import_obj(obj)
    paint(objects)
    findings, tested = watch_report(objects)
    print(f'imported {len(objects)} objects from {obj}')
    print(f'checked {tested} must-not-touch pairs')
    if findings:
        print(f'{len(findings)} pairs intersect:')
        for count, a, b in findings[:20]:
            print(f'  {count:5d} faces  {a}  x  {b}')
    else:
        print('must-not-touch pairs: clean')
    render(bpy.context.scene)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'hall-scene.blend'))
    print('saved', os.path.join(OUT, 'hall-scene.blend'))


main()
