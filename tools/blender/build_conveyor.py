"""Build the hall conveyor in Blender.

The conveyor used to be a pile of boxes built at runtime. It is one modelled
machine now: stringers, deck, cleated-free belt, head and tail drums, legs
with feet and braces, a discharge platform, a drive unit with a chain guard,
and a feed housing the belt climbs out of.

Everything is baked into the game frame, so the runtime does no scaling and
no re-mirroring. Game space is Y-up (Babylon) and Blender is Z-up, so every
point below is authored in game space and converted once through G(): the
glTF exporter writes (x, y, z) -> (x, z, -y).

The belt line is the path `CONVEYOR_PATH` already animates parts along, so
the belt surface, the drums and the platform all follow from those two
points rather than from numbers typed twice.

Geometry accumulates straight into one mesh per material, with planar UVs at
one tile per metre (the belt's UVs span one repeat across the width and the
ramp along its length). The exporter has nothing to repair and the runtime
gets five draw calls.

Usage:
    blender --background --python tools/blender/build_conveyor.py
"""

import math
import os

import bpy
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BLEND = os.path.join(ROOT, 'tools', 'blender', 'conveyor.blend')
GLB = os.path.join(ROOT, 'public', 'models', 'hall', 'conveyor.glb')

# The belt line the game already animates parts along.
B = Vector((0.62, -0.45, 2.85))
T = Vector((0.62, 1.16, 0.55))
U = (T - B).normalized()
NRM = Vector((0.0, 0.8192, 0.5736))

CUBE = [
    (-0.5, -0.5, -0.5), (-0.5, -0.5, 0.5), (-0.5, 0.5, -0.5),
    (-0.5, 0.5, 0.5), (0.5, -0.5, -0.5), (0.5, -0.5, 0.5),
    (0.5, 0.5, -0.5), (0.5, 0.5, 0.5),
]
CUBE_FACES = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
              (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]


def G(p):
    return Vector((p[0], -p[2], p[1]))


def path(s, off=0.0):
    return B + U * s + NRM * off


class Bucket:
    def __init__(self):
        self.verts = []
        self.faces = []

    def add(self, verts, faces, matrix):
        base = len(self.verts)
        for vert in verts:
            self.verts.append(matrix @ Vector(vert))
        for face in faces:
            self.faces.append(tuple(base + index for index in face))


def material(name, color, rough=0.62, metal=0.25):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    mat.diffuse_color = (*color, 1.0)
    return mat


def box(bucket, center, size):
    scale = Matrix.Diagonal(Vector((size[0], size[2], size[1], 1.0)))
    bucket.add(CUBE, CUBE_FACES, Matrix.Translation(G(center)) @ scale)


def beam(bucket, p0, p1, width, thick, up=(0, 1, 0)):
    span = G(p1) - G(p0)
    y_axis = span.normalized()
    hint = G(up)
    z_axis = (hint - y_axis * hint.dot(y_axis)).normalized()
    x_axis = y_axis.cross(z_axis)
    basis = Matrix((x_axis, y_axis, z_axis)).transposed().to_4x4()
    scale = Matrix.Diagonal(Vector((width, span.length, thick, 1.0)))
    mid = (G(p0) + G(p1)) * 0.5
    bucket.add(CUBE, CUBE_FACES, Matrix.Translation(mid) @ basis @ scale)


def cyl(bucket, center, radius, length, axis='x', segments=16):
    verts = []
    faces = []
    for index in range(segments):
        angle = 2 * math.pi * index / segments
        verts.append((radius * math.cos(angle), radius * math.sin(angle),
                      -length / 2))
        verts.append((radius * math.cos(angle), radius * math.sin(angle),
                      length / 2))
    for index in range(segments):
        nxt = (index + 1) % segments
        faces.append((2 * index, 2 * nxt, 2 * nxt + 1, 2 * index + 1))
    faces.append(tuple(range(0, 2 * segments, 2))[::-1])
    faces.append(tuple(range(1, 2 * segments, 2)))
    if axis == 'x':
        rot = Matrix.Rotation(math.pi / 2, 4, 'Y')
    elif axis == 'y':
        rot = Matrix.Rotation(math.pi / 2, 4, 'X')
    else:
        rot = Matrix.Identity(4)
    bucket.add(verts, faces, Matrix.Translation(G(center)) @ rot)


def make_uv(mesh, mode='box'):
    """Planar UVs at one tile per metre, except the belt, whose UVs span one
    repeat across the width and the full ramp along its length."""
    layer = mesh.uv_layers.new(name='UVMap')
    coords = [vertex.co for vertex in mesh.vertices]
    for poly in mesh.polygons:
        points = [coords[index] for index in poly.vertices]
        if mode == 'belt':
            for loop_index, point in zip(poly.loop_indices, points):
                layer.data[loop_index].uv = ((point.x - 0.45) / 0.34,
                                             (2.85 - point.z) / 2.72)
            continue
        normal = poly.normal
        axis = max(range(3), key=lambda i: abs(normal[i]))
        for loop_index, point in zip(poly.loop_indices, points):
            if axis == 0:
                uv = (point.y, point.z)
            elif axis == 1:
                uv = (point.x, point.z)
            else:
                uv = (point.x, point.y)
            layer.data[loop_index].uv = uv


def clear_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras,
                  bpy.data.lights, bpy.data.worlds):
        for entry in list(block):
            block.remove(entry)


def build():
    clear_scene()
    bpy.context.scene.unit_settings.system = 'METRIC'

    mats = {
        'frame': material('frame', (0.026, 0.032, 0.055), 0.55, 0.45),
        'steel': material('steel', (0.075, 0.090, 0.140), 0.35, 0.75),
        'rubber': material('rubber', (0.012, 0.016, 0.024), 0.85, 0.0),
        'hazard': material('hazard', (0.72, 0.53, 0.10), 0.60, 0.10),
        'belt': material('belt', (0.020, 0.030, 0.040), 0.80, 0.0),
    }
    frame = Bucket()
    steel = Bucket()
    rubber = Bucket()
    hazard = Bucket()
    belt = Bucket()

    # --- belt and deck ---------------------------------------------------
    beam(belt, path(0.05, 0.014), path(2.72, 0.014), 0.34, 0.020)
    beam(frame, path(0.02, -0.012), path(2.74, -0.012), 0.40, 0.030)

    # --- side stringers, cross members, guide rails ----------------------
    for side in (-1, 1):
        x = 0.62 + side * 0.215
        beam(frame, Vector((x,) + path(0.02, -0.11)[1:]),
             Vector((x,) + path(2.74, -0.11)[1:]), 0.030, 0.200)
        xr = 0.62 + side * 0.187
        beam(steel, Vector((xr,) + path(0.30, 0.045)[1:]),
             Vector((xr,) + path(2.60, 0.045)[1:]), 0.018, 0.040)

    for s in (0.35, 0.85, 1.35, 1.85, 2.35):
        centre = path(s, -0.20)
        beam(frame, Vector((0.42, centre.y, centre.z)),
             Vector((0.82, centre.y, centre.z)), 0.040, 0.040)

    # --- rollers under the deck -----------------------------------------
    for s in (0.70, 1.50, 2.20):
        cyl(rubber, path(s, -0.100), 0.028, 0.38)

    # --- head and tail drums with bearing plates ------------------------
    head = Vector((0.62, 1.0695, 0.622))
    tail = Vector((0.62, -0.409, 2.756))
    for drum, radius in ((head, 0.0555), (tail, 0.055)):
        cyl(steel, drum, radius, 0.40)
        for side in (-1, 1):
            box(frame, (0.62 + side * 0.232, drum.y, drum.z),
                (0.016, 0.140, 0.140))

    # --- legs ------------------------------------------------------------
    for s in (1.62, 2.30):
        base = path(s, -0.11)
        height = base.y + 0.010
        for side in (-1, 1):
            x = 0.62 + side * 0.195
            box(frame, (x, height / 2, base.z), (0.045, height, 0.045))
            box(steel, (x, 0.012, base.z), (0.130, 0.024, 0.130))
        cyl(steel, Vector((0.62, base.y * 0.55, base.z)), 0.022, 0.39)

    # --- discharge platform ---------------------------------------------
    box(steel, (0.62, 1.115, 0.455), (0.46, 0.030, 0.35))
    for side in (-1, 1):
        box(steel, (0.62 + side * 0.222, 1.1475, 0.455),
            (0.016, 0.035, 0.35))
        x = 0.62 + side * 0.20
        box(frame, (x, 0.55, 0.60), (0.040, 1.100, 0.040))
        box(steel, (x, 0.012, 0.60), (0.120, 0.024, 0.120))
    box(steel, (0.62, 1.1475, 0.288), (0.46, 0.035, 0.016))
    box(frame, (0.62, 0.55, 0.60), (0.44, 0.030, 0.030))
    beam(frame, Vector((0.62, 1.00, 0.34)), Vector((0.62, 0.98, 0.60)),
         0.30, 0.030, up=(1, 0, 0))

    # --- drive unit ------------------------------------------------------
    box(steel, (0.850, 1.030, 0.620), (0.020, 0.240, 0.300))
    box(steel, (0.885, 1.090, 0.620), (0.090, 0.150, 0.140))
    cyl(steel, Vector((0.985, 1.075, 0.620)), 0.050, 0.150)
    cyl(frame, Vector((1.075, 1.075, 0.620)), 0.056, 0.025)
    box(frame, (0.900, 1.185, 0.620), (0.060, 0.050, 0.060))

    # --- feed housing at the low end ------------------------------------
    hx0, hx1 = 0.34, 0.90
    hz0, hz1 = 2.05, 2.90
    htop = 0.68
    hcx = (hx0 + hx1) / 2
    box(frame, (hx0 + 0.01, htop / 2, (hz0 + hz1) / 2),
        (0.020, htop, hz1 - hz0))
    box(frame, (hx1 - 0.01, htop / 2, (hz0 + hz1) / 2),
        (0.020, htop, hz1 - hz0))
    box(frame, (hcx, htop / 2, hz1 - 0.01), (hx1 - hx0, htop, 0.020))
    box(frame, (hcx, htop - 0.01, (hz0 + hz1) / 2),
        (hx1 - hx0, 0.020, hz1 - hz0))
    # The front is a panel above the belt mouth only: below it the ramp
    # passes through the opening instead of clipping a wall.
    box(frame, (hcx, (0.24 + htop) / 2, hz0 + 0.01),
        (hx1 - hx0, htop - 0.24, 0.020))
    box(hazard, (hcx, 0.44, hz0 - 0.002), (0.44, 0.26, 0.012))

    made = []
    for name, bucket in (('frame', frame), ('steel', steel),
                         ('rubber', rubber), ('hazard', hazard),
                         ('belt', belt)):
        mesh = bpy.data.meshes.new('conveyor-' + name)
        mesh.from_pydata([tuple(v) for v in bucket.verts], [], bucket.faces)
        mesh.update()
        make_uv(mesh, 'belt' if name == 'belt' else 'box')
        mesh.validate()
        ob = bpy.data.objects.new('conveyor-' + name, mesh)
        bpy.context.collection.objects.link(ob)
        ob.data.materials.append(mats[name])
        made.append(ob)
        mesh.calc_loop_triangles()
        print(name, len(mesh.vertices), 'verts', len(mesh.polygons), 'faces',
              len(mesh.loop_triangles), 'tris')

    print('total verts', sum(len(o.data.vertices) for o in made),
          'tris', sum(len(o.data.loop_triangles) for o in made))
    return made


def export(made):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in made:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = made[0]
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    bpy.ops.export_scene.gltf(
        filepath=GLB,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
    )
    print('wrote', GLB)


joined_objects = build()
export(joined_objects)
