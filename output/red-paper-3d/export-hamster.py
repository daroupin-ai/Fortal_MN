"""Export a lightweight copy of the Blender hamster; never save the source file."""
import bpy
import json
import sys
from pathlib import Path
from array import array

out = Path(__file__).parent
objects = [o for c in bpy.data.collections if c.name.startswith(('Mochi', 'Bread'))
           for o in c.objects if o.type in {'MESH', 'CURVE'} and not o.hide_render]
objects = list(dict.fromkeys(objects))
if not objects:
    raise RuntimeError('Hamster collections were not found')
groups = {'body': [], 'leftPaw': [], 'rightPaw': [], 'mouth': []}
inventory = []
for obj in objects:
    name = obj.name
    inventory.append({'name': name, 'type': obj.type})
    if obj.type == 'MESH':
        triangle_estimate = sum(len(p.vertices)-2 for p in obj.data.polygons)
        budget = 24000 if 'continuous body' in name else 5000 if 'bread' in name.lower() else 1000
        if triangle_estimate > budget:
            decimate = obj.modifiers.new('Web copy only', 'DECIMATE')
            decimate.ratio = budget / triangle_estimate
    else:
        obj.data.resolution_u = 4
        obj.data.bevel_resolution = 1
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
for obj in objects:
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=depsgraph)
    mesh.calc_loop_triangles()
    matrix = obj.matrix_world
    normal_matrix = matrix.to_3x3().inverted().transposed()
    group = 'body'
    if obj.name.startswith(('Front paw', 'Curled finger', 'Small nail', 'Finger crease')):
        group = 'leftPaw' if matrix.translation.x < 0 else 'rightPaw'
    elif obj.name.startswith('Natural mouth line'):
        group = 'mouth'
    target = groups[group]
    coat = mesh.color_attributes.get('CoatColor')
    for tri in mesh.loop_triangles:
        mat = mesh.materials[tri.material_index] if mesh.materials else None
        color = tuple(mat.diffuse_color[:3]) if mat else (.65, .45, .24)
        if mat and mat.use_nodes:
            shader = mat.node_tree.nodes.get('Principled BSDF')
            if shader and not shader.inputs['Base Color'].is_linked:
                color = tuple(shader.inputs['Base Color'].default_value[:3])
        for vertex_index, loop_index in zip(tri.vertices, tri.loops):
            vertex = mesh.vertices[vertex_index]
            p = matrix @ vertex.co
            n = (normal_matrix @ mesh.corner_normals[loop_index].vector).normalized()
            rgb = coat.data[vertex_index if coat.domain == 'POINT' else loop_index].color[:3] if coat else color
            crust_mask = mesh.attributes.get('bread_crust_mask')
            if mat and 'fading into crust' in mat.name and crust_mask:
                blend = max(0, min(1, crust_mask.data[vertex_index].value))
                rgb = [a*(1-blend)+b*blend for a,b in zip((.79,.69,.53),(.44,.19,.055))]
            # Blender linear colors -> display colors, Z-up -> Y-up, face toward +Z.
            rgb = [max(0, min(1, v)) ** (1/2.2) for v in rgb]
            target.extend([p.x, p.z, -p.y, n.x, n.z, -n.y, *rgb, 0, 0])
    evaluated.to_mesh_clear()
data = array('f')
ranges = {}
for name, values in groups.items():
    ranges[name] = {'first': len(data)//11, 'count': len(values)//11}
    data.extend(values)
if sys.byteorder != 'little':
    data.byteswap()
(out/'hamster.bin').write_bytes(data.tobytes())
metadata = {'source': '블렌더/mochi_toast_highpoly/mochi_highpoly.blend',
            'stride': 11, 'vertices': len(data)//11, 'groups': ranges,
            'mouth': [0, .99, 1.11], 'pawCenters': [[-.38,.555,.88],[.38,.555,.88]],
            'objects': inventory, 'note': 'Reduced mesh copy; individual fur strands omitted. Source unchanged.'}
(out/'hamster.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'vertices': metadata['vertices'], 'bytes': len(data)*4, 'groups': ranges}))
