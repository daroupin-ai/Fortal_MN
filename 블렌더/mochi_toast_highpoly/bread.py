"""Detailed, independently movable bread slices with modeled crumb pores."""

import math

import bpy
import numpy as np


def _noise(nodes, links, coordinates, scale, detail=3.0, roughness=0.7):
    node = nodes.new('ShaderNodeTexNoise')
    node.inputs['Scale'].default_value = scale
    node.inputs['Detail'].default_value = detail
    node.inputs['Roughness'].default_value = roughness
    links.new(coordinates, node.inputs['Vector'])
    return node.outputs['Fac']


def _ramp(nodes, links, value, stops):
    node = nodes.new('ShaderNodeValToRGB')
    ramp = node.color_ramp
    ramp.elements.remove(ramp.elements[1])
    for index, (position, color) in enumerate(stops):
        element = ramp.elements[0] if index == 0 else ramp.elements.new(position)
        element.position = position
        element.color = (*color, 1.0)
    links.new(value, node.inputs['Fac'])
    return node.outputs['Color']


def _bread_materials():
    crumb = bpy.data.materials.new('Bread · porous ivory crumb')
    crumb.diffuse_color = (0.79, 0.69, 0.53, 1)
    crumb.use_nodes = True
    nodes = crumb.node_tree.nodes
    links = crumb.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = 0.88
    shader.inputs['Subsurface Weight'].default_value = 0.065
    shader.inputs['Subsurface Radius'].default_value = (0.6, 0.35, 0.15)
    coordinates = nodes.new('ShaderNodeTexCoord').outputs['Object']
    mottling = _noise(nodes, links, coordinates, 9, 4)
    color = _ramp(nodes, links, mottling, [
        (0.20, (0.56, 0.41, 0.25)),
        (0.48, (0.78, 0.66, 0.48)),
        (0.80, (0.91, 0.82, 0.67)),
    ])
    links.new(color, shader.inputs['Base Color'])
    fine = _noise(nodes, links, coordinates, 180, 3)
    pores = nodes.new('ShaderNodeTexVoronoi')
    pores.distance = 'EUCLIDEAN'
    pores.inputs['Scale'].default_value = 72
    links.new(coordinates, pores.inputs['Vector'])
    pore_shape = _ramp(nodes, links, pores.outputs['Distance'], [
        (0.09, (0.0, 0.0, 0.0)),
        (0.20, (0.10, 0.10, 0.10)),
        (0.33, (0.65, 0.65, 0.65)),
        (0.52, (0.76, 0.76, 0.76)),
    ])
    fine_bump = nodes.new('ShaderNodeBump')
    fine_bump.inputs['Strength'].default_value = 0.40
    fine_bump.inputs['Distance'].default_value = 0.008
    links.new(fine, fine_bump.inputs['Height'])
    pore_bump = nodes.new('ShaderNodeBump')
    pore_bump.inputs['Strength'].default_value = 0.48
    pore_bump.inputs['Distance'].default_value = 0.025
    links.new(pore_shape, pore_bump.inputs['Height'])
    links.new(fine_bump.outputs['Normal'], pore_bump.inputs['Normal'])
    links.new(pore_bump.outputs['Normal'], shader.inputs['Normal'])

    crust = bpy.data.materials.new('Bread · baked golden crust')
    crust.diffuse_color = (0.44, 0.19, 0.055, 1)
    crust.use_nodes = True
    nodes = crust.node_tree.nodes
    links = crust.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = 0.68
    shader.inputs['Subsurface Weight'].default_value = 0.025
    coordinates = nodes.new('ShaderNodeTexCoord').outputs['Object']
    baked = _noise(nodes, links, coordinates, 7, 5)
    color = _ramp(nodes, links, baked, [
        (0.20, (0.21, 0.064, 0.012)),
        (0.46, (0.43, 0.19, 0.045)),
        (0.70, (0.66, 0.36, 0.12)),
        (0.86, (0.75, 0.49, 0.24)),
    ])
    links.new(color, shader.inputs['Base Color'])
    tiny = _noise(nodes, links, coordinates, 135, 3)
    tiny_bump = nodes.new('ShaderNodeBump')
    tiny_bump.inputs['Strength'].default_value = 0.5
    tiny_bump.inputs['Distance'].default_value = 0.014
    links.new(tiny, tiny_bump.inputs['Height'])
    wrinkle = _noise(nodes, links, coordinates, 31, 4)
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.45
    bump.inputs['Distance'].default_value = 0.025
    links.new(wrinkle, bump.inputs['Height'])
    links.new(tiny_bump.outputs['Normal'], bump.inputs['Normal'])
    links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    side = crumb.copy()
    side.name = 'Bread · torn crumb fading into crust'
    nodes = side.node_tree.nodes
    links = side.node_tree.links
    shader = nodes.get('Principled BSDF')
    coordinates = nodes.new('ShaderNodeTexCoord').outputs['Object']
    crumb_variation = _noise(nodes, links, coordinates, 42, 3)
    crumb_color = _ramp(nodes, links, crumb_variation, [
        (0.20, (0.77, 0.68, 0.53)),
        (0.50, (0.82, 0.73, 0.58)),
        (0.80, (0.88, 0.80, 0.67)),
    ])
    crust_noise = _noise(nodes, links, coordinates, 17, 3)
    crust_color = _ramp(nodes, links, crust_noise, [
        (0.20, (0.39, 0.17, 0.041)),
        (0.50, (0.51, 0.25, 0.071)),
        (0.80, (0.65, 0.37, 0.14)),
    ])
    attribute = nodes.new('ShaderNodeAttribute')
    attribute.attribute_name = 'bread_crust_mask'
    irregularity = nodes.new('ShaderNodeMath')
    irregularity.operation = 'MULTIPLY_ADD'
    irregularity.inputs[1].default_value = 0.32
    irregularity.inputs[2].default_value = -0.16
    links.new(crust_noise, irregularity.inputs[0])
    mask = nodes.new('ShaderNodeMath')
    mask.operation = 'ADD'
    mask.use_clamp = True
    links.new(attribute.outputs['Fac'], mask.inputs[0])
    links.new(irregularity.outputs[0], mask.inputs[1])
    mix = nodes.new('ShaderNodeMixRGB')
    links.new(mask.outputs[0], mix.inputs[0])
    links.new(crumb_color, mix.inputs[1])
    links.new(crust_color, mix.inputs[2])
    links.new(mix.outputs[0], shader.inputs['Base Color'])
    for node in nodes:
        if node.bl_idname == 'ShaderNodeBump':
            if node.inputs['Distance'].default_value > 0.02:
                node.inputs['Strength'].default_value = 0.34
                node.inputs['Distance'].default_value = 0.018
            else:
                node.inputs['Strength'].default_value = 0.24
                node.inputs['Distance'].default_value = 0.004
    shader.inputs['Subsurface Weight'].default_value = 0.10
    return crumb, crust, side


def _smoothstep(values, lower, upper):
    normalized = np.clip((values - lower) / (upper - lower), 0, 1)
    return normalized * normalized * (3 - 2 * normalized)


def _crust_mask(points, t):
    front = _smoothstep(-points[:, 1], 0.65, 1.10)
    center = 1 - _smoothstep(np.abs(points[:, 0]), 0.95, 1.57)
    bottom_border = _smoothstep(np.asarray(t), 0.88, 0.99)
    return 1 - front * center * (1 - bottom_border)


def _crumb_relief(rows, columns, rng):
    """Irregular depressions in the actual mesh, in Blender length units."""
    relief = rng.normal(0, 0.0015, (rows, columns))
    for index in range(2150):
        center_x = rng.uniform(1, columns - 2)
        center_y = rng.uniform(1, rows - 2)
        radius_x = rng.uniform(0.6, 2.5)
        radius_y = radius_x * rng.uniform(0.55, 1.65)
        depth = rng.uniform(0.007, 0.025)
        if index < 120:
            radius_x *= 1.7
            radius_y *= 1.5
            depth *= 1.5
        left = max(0, int(center_x - radius_x * 2.5))
        right = min(columns, int(center_x + radius_x * 2.5) + 1)
        bottom = max(0, int(center_y - radius_y * 2.5))
        top = min(rows, int(center_y + radius_y * 2.5) + 1)
        y, x = np.mgrid[bottom:top, left:right]
        distance = ((x - center_x) / radius_x) ** 2 + ((y - center_y) / radius_y) ** 2
        relief[bottom:top, left:right] -= depth * np.exp(-distance * 1.8)
        relief[bottom:top, left:right] += 0.0018 * np.exp(-((distance - 1.4) ** 2) * 3)
    return relief


def _make_slice(name, center_z, materials, seed, arch=False):
    rows, columns = 201, 241
    rng = np.random.default_rng(seed)
    v, u = np.meshgrid(np.linspace(-1, 1, rows), np.linspace(-1, 1, columns), indexing='ij')
    radius = np.maximum(np.abs(u), np.abs(v))
    angle = np.arctan2(v, u)
    cosine, sine = np.cos(angle), np.sin(angle)
    norm = (np.abs(cosine) ** 5.0 + np.abs(sine) ** 5.0) ** (-1 / 5.0)
    x = 1.675 * radius * norm * cosine
    y = 1.275 * radius * norm * sine
    # Small baked asymmetry breaks the perfect rounded-square silhouette.
    x *= 1 + 0.012 * v + 0.007 * np.sin(v * 7 + 0.6)
    y += 0.012 * np.sin(u * 6 + 0.5) * radius ** 3
    warp = 0.012 * np.sin(u * 3 + 0.4) * np.cos(v * 4)
    if arch:
        warp += 0.15 * np.exp(-((u / 0.60) ** 2)) * np.maximum(-v, 0) ** 3
        warp += 0.025 * v
    puff = 0.018 * (1 - radius ** 2)
    edge_fade = np.clip((1 - radius) / 0.035, 0, 1)
    top_z = 0.24 + puff + warp + _crumb_relief(rows, columns, rng) * edge_fade
    bottom_z = -0.24 - puff + warp - _crumb_relief(rows, columns, rng) * edge_fade
    top_points = np.stack((x * 0.982, y * 0.982, top_z), axis=-1).reshape(-1, 3)
    bottom_points = np.stack((x * 0.982, y * 0.982, bottom_z), axis=-1).reshape(-1, 3)
    count = rows * columns
    vertices = top_points.tolist() + bottom_points.tolist()
    faces = []
    material_indices = []
    for row in range(rows - 1):
        for col in range(columns - 1):
            index = row * columns + col
            faces.append((index, index + 1, index + columns + 1, index + columns))
            faces.append((index + count, index + columns + count,
                          index + columns + count + 1, index + count + 1))
            rim = radius[row, col] > 0.985 + 0.003 * math.sin(row * 0.37 + col * 0.71)
            material_indices.extend((int(rim), int(rim)))

    boundary = list(range(columns))
    boundary += [row * columns + columns - 1 for row in range(1, rows)]
    boundary += [(rows - 1) * columns + col for col in range(columns - 2, -1, -1)]
    boundary += [row * columns for row in range(rows - 2, 0, -1)]
    perimeter = len(boundary)
    rings = [boundary]
    ring_count = 64
    top_edge = top_points[boundary]
    bottom_edge = bottom_points[boundary]
    side_relief = _crumb_relief(ring_count + 1, perimeter, rng)
    crust_masks = _crust_mask(top_points, 0).tolist() + _crust_mask(bottom_points, 1).tolist()
    for ring_index in range(1, ring_count):
        t = ring_index / ring_count
        edge = top_edge * (1 - t) + bottom_edge * t
        roundness = 1 + 0.025 * math.sin(math.pi * t) ** 0.55
        edge[:, :2] *= roundness
        mask = _crust_mask(edge, t)
        wrinkle = rng.normal(0, 0.002, perimeter) * math.sin(math.pi * t)
        wrinkle += side_relief[ring_index] * (0.25 + 0.75 * (1 - mask))
        radial = edge[:, :2] / np.linalg.norm(edge[:, :2], axis=1)[:, None]
        edge[:, :2] += radial * wrinkle[:, None]
        start = len(vertices)
        vertices.extend(edge.tolist())
        crust_masks.extend(mask.tolist())
        rings.append(list(range(start, start + perimeter)))
    rings.append([index + count for index in boundary])
    for upper, lower in zip(rings[:-1], rings[1:]):
        for index in range(perimeter):
            next_index = (index + 1) % perimeter
            faces.append((upper[next_index], upper[index], lower[index], lower[next_index]))
            material_indices.append(2)

    mesh = bpy.data.meshes.new(name + '_HighPolyMesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.clear()
    for mat in materials:
        mesh.materials.append(mat)
    mesh.polygons.foreach_set('material_index', material_indices)
    mesh.polygons.foreach_set('use_smooth', [True] * len(faces))
    mask_attribute = mesh.attributes.new('bread_crust_mask', 'FLOAT', 'POINT')
    mask_attribute.data.foreach_set('value', crust_masks)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location.z = center_z
    uv_layer = mesh.uv_layers.new(name='Bread_UV')
    vertex_positions = np.array(vertices)
    loop_indices = np.empty(len(mesh.loops), dtype=np.int32)
    mesh.loops.foreach_get('vertex_index', loop_indices)
    uv = vertex_positions[loop_indices, :2] / np.array([3.5, 2.7]) + 0.5
    uv_layer.data.foreach_set('uv', uv.astype(np.float32).ravel())
    obj['asset_role'] = 'Independent high-poly bread slice'
    obj['surface_detail'] = 'Modeled irregular crumb pores, baked crust, self-contained procedural textures'
    return obj


def build_bread():
    """Return independent bottom and top bread objects in the current scene."""
    materials = _bread_materials()
    bottom = _make_slice('Bread_Bottom_HighPoly', 0.24, materials, 14)
    top = _make_slice('Bread_Top_HighPoly', 2.02, materials, 37, arch=True)
    top.rotation_euler[0] = math.radians(-3)
    top.location.y = 0.035
    return bottom, top
