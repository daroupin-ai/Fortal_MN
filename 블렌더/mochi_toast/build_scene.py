import bpy
import math
import os
import numpy as np
from mathutils import Vector

OUT = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(OUT, 'textures'), exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def texture(name, colors, kind):
    size = 1024
    rng = np.random.default_rng(42)
    y, x = np.mgrid[0:size, 0:size].astype(float) / size
    grain = rng.normal(0, 1, (size, size))
    if kind == 'fur':
        streaks = sum(np.roll(grain, offset, axis=0) for offset in range(12)) / 12
        variation = .025 * grain + .10 * streaks
    else:
        variation = .02 * grain + .025 * np.sin(x * 70) * np.cos(y * 83)
        for _ in range(2100 if kind == 'crumb' else 900):
            cx, cy = rng.integers(0, size, 2)
            radius = int(rng.integers(1, 6 if kind == 'crumb' else 4))
            left, right = max(0, cx-radius*2), min(size, cx+radius*2+1)
            top, bottom = max(0, cy-radius*2), min(size, cy+radius*2+1)
            yy, xx = np.mgrid[top:bottom, left:right]
            d = ((xx-cx)**2 + (yy-cy)**2) / radius**2
            variation[top:bottom,left:right] -= .22 * np.exp(-d*2)
            variation[top:bottom,left:right] += .045 * np.exp(-((d-1.2)**2)*3)
    rgba = np.ones((size,size,4), dtype=np.float32)
    rgba[:,:,:3] = np.clip(np.array(colors)[None,None,:] + variation[:,:,None], .01, 1)
    image = bpy.data.images.new(name, width=size, height=size)
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = os.path.join(OUT, 'textures', name+'.png')
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image

def material(name, color, image=None, roughness=.6, bump=.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color,1)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color,1)
    shader.inputs['Roughness'].default_value = roughness
    if image:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = image
        mat.node_tree.links.new(tex.outputs['Color'], shader.inputs['Base Color'])
        if bump:
            relief = nodes.new('ShaderNodeBump')
            relief.inputs['Strength'].default_value = .24
            relief.inputs['Distance'].default_value = bump
            mat.node_tree.links.new(tex.outputs['Color'],relief.inputs['Height'])
            mat.node_tree.links.new(relief.outputs['Normal'],shader.inputs['Normal'])
    return mat

gold = material('Fur · honey',(.61,.39,.19),texture('fur_honey',(.69,.50,.30),'fur'),bump=.009)
cream = material('Fur · ivory',(.88,.78,.60),texture('fur_ivory',(.93,.85,.71),'fur'),bump=.007)
crumb = material('Bread · soft crumb',(.86,.68,.40),texture('bread_crumb',(.94,.82,.60),'crumb'),bump=.035)
crust = material('Bread · golden crust',(.55,.22,.045),texture('bread_crust',(.69,.36,.12),'crust'),bump=.025)
pink = material('Paws and nose · rose',(.67,.27,.24),roughness=.48)
inner_ear = material('Inner ears · warm pink',(.65,.34,.29),roughness=.7)
eye = material('Eyes · espresso glass',(.009,.006,.004),roughness=.12)
mouth = material('Mouth · cocoa',(.20,.105,.067),roughness=.65)
whisker_mat = material('Whiskers · warm ivory',(.53,.43,.31),roughness=.65)

character_parts=[]
def ellipsoid(name, location, scale, mat, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj=bpy.context.object
    obj.name=name
    obj.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth=True
    character_parts.append(obj)
    return obj

ellipsoid('Body', (0,.29,1.0),(.98,.80,.72),gold)
ellipsoid('Head', (0,-.22,1.25),(1.04,.73,.78),gold,24,14)
ellipsoid('White bib', (0,-.36,.77),(.74,.56,.41),cream)
for sign in [-1,1]:
    ellipsoid('Cheek', (sign*.53,-.68,1.06),(.57,.43,.43),cream)
    ear=ellipsoid('Ear', (sign*.76,-.05,1.88),(.27,.14,.31),gold,16,10)
    ellipsoid('Ear center', (sign*.76,-.165,1.90),(.18,.045,.21),inner_ear,16,10)
    ellipsoid('Eye rim', (sign*.40,-.845,1.48),(.205,.10,.24),gold,16,10)
    ellipsoid('Eye', (sign*.40,-.922,1.48),(.15,.095,.183),eye,20,12)
    ellipsoid('Muzzle', (sign*.16,-1.006,1.10),(.23,.12,.20),cream,16,10)
    ellipsoid('Front paw', (sign*.39,-.88,.55),(.20,.245,.12),pink,16,8)
    for digit in range(3):
        ellipsoid('Toe', (sign*.39+(digit-1)*.085,-1.045,.55),(.041,.087,.065),pink,10,6)
    ellipsoid('Back foot', (sign*.68,.54,.48),(.24,.30,.13),pink,12,8)
ellipsoid('Tail', (0,.99,.77),(.13,.20,.13),pink,12,8)
nose=ellipsoid('Nose', (0,-1.14,1.16),(.115,.078,.087),pink,12,8)

def line_mesh(name, points, radius, mat):
    curve=bpy.data.curves.new(name,'CURVE')
    curve.dimensions='3D'
    curve.resolution_u=1
    curve.bevel_depth=radius
    curve.bevel_resolution=0
    spline=curve.splines.new('POLY')
    spline.points.add(len(points)-1)
    for i,point in enumerate(points):
        spline.points[i].co=(*point,1)
        spline.points[i].radius=1-i/(len(points)+.2)
    obj=bpy.data.objects.new(name,curve)
    scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target='MESH')
    character_parts.append(bpy.context.object)

line_mesh('Mouth',[(0,-1.125,1.11),(0,-1.126,1.005),(-.10,-1.10,.966)],.013,mouth)
line_mesh('Smile',[(0,-1.126,1.005),(.10,-1.10,.966)],.013,mouth)
for sign in [-1,1]:
    for i in range(3):
        line_mesh('Whisker',[(sign*.32,-1.06,1.09-i*.055),(sign*.73,-1.11,1.10+(1-i)*.10),(sign*1.16,-1.04,1.10+(1-i)*.17)],.008,whisker_mat)

bpy.ops.object.select_all(action='DESELECT')
for obj in character_parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active=character_parts[0]
bpy.ops.object.join()
hamster=bpy.context.object
hamster.name='Mochi_Hamster'
hamster['description']='Independent low-poly hamster with UV image textures. Front points toward -Y.'
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY',center='BOUNDS')

def bread(name, z):
    # A rounded square slice with a slightly broader, domed back edge.
    outline=[]
    for cx,cy,start in [(1.23,.79,0),(-1.23,.79,90),(-1.23,-.79,180),(1.23,-.79,270)]:
        for i in range(6):
            angle=math.radians(start+i*90/5)
            outline.append((cx+.40*math.cos(angle),cy+.40*math.sin(angle)))
    verts=[]
    for scale,height in [(.94,-.18),(1,-.12),(1,.12),(.94,.18),(.89,.185)]:
        for x,y in outline:
            verts.append((x*scale,y*scale,z+height))
    n=len(outline)
    faces=[]
    mats=[]
    for ring in range(4):
        for i in range(n):
            j=(i+1)%n
            faces.append((ring*n+i,ring*n+j,(ring+1)*n+j,(ring+1)*n+i))
            mats.append(1 if ring<3 else 0)
    faces.append(tuple(range(4*n,5*n)))
    mats.append(0)
    faces.append(tuple(reversed(range(n))))
    mats.append(0)
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(crumb)
    mesh.materials.append(crust)
    uv=mesh.uv_layers.new(name='UVMap')
    for poly,mi in zip(mesh.polygons,mats):
        poly.material_index=mi
        poly.use_smooth=mi==1
        for li in poly.loop_indices:
            v=mesh.vertices[mesh.loops[li].vertex_index].co
            if mi==0:
                uv.data[li].uv=(v.x/3.5+.5,v.y/2.6+.5)
            else:
                uv.data[li].uv=((math.atan2(v.y,v.x)/(2*math.pi))%1,(v.z-z+.18)/.36)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY',center='BOUNDS')
    obj['description']='Independent bread slice with crumb and crust image textures.'
    return obj

bottom=bread('Bread_Bottom',.24)
top=bread('Bread_Top',2.13)
top.rotation_euler[0]=math.radians(-7)
top.location.y=.06

models=bpy.data.collections.new('Mochi and Bread · 3 separate objects')
scene.collection.children.link(models)
for obj in [hamster,bottom,top]:
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    models.objects.link(obj)

studio=bpy.data.collections.new('Studio · lights and backdrop')
scene.collection.children.link(studio)
def to_studio(obj):
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    studio.objects.link(obj)

floor=material('Backdrop · warm cream',(.55,.46,.35),roughness=.9)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,.035))
bpy.context.object.name='Studio_Backdrop'
bpy.context.object.data.materials.append(floor)
to_studio(bpy.context.object)

def aim(obj,point):
    obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()

for name,location,power,size in [('Key',(-3,-4,7),650,4),('Fill',(4,-2,4),420,3),('Rim',(0,4,6),850,3)]:
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    studio.objects.link(obj)
    obj.location=location
    aim(obj,(0,0,1))

data=bpy.data.cameras.new('Camera')
camera=bpy.data.objects.new('Camera',data)
studio.objects.link(camera)
camera.location=(1.8,-8.8,3.7)
aim(camera,(0,0,1.15))
data.type='ORTHO'
data.ortho_scale=5.05
scene.camera=camera
scene.world=bpy.data.worlds.new('Warm studio')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.63,.78,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.render.engine='CYCLES'
scene.cycles.samples=40
scene.cycles.use_denoising=True
scene.render.resolution_x=1200
scene.render.resolution_y=1100
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.filepath=os.path.join(OUT,'mochi_toast_preview.png')
bpy.ops.object.select_all(action='DESELECT')
hamster.select_set(True)
bpy.context.view_layer.objects.active=hamster
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.type='MATERIAL'
scene['asset_notes']='Three independent meshes. Four packed 1024px UV texture maps. Reference rear anatomy inferred.'
for obj in [hamster,top,bottom]:
    obj.data.calc_loop_triangles()
    print('ASSET',obj.name,'triangles',len(obj.data.loop_triangles),'UV',len(obj.data.uv_layers))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'mochi_toast.blend'))
bpy.ops.render.render(write_still=True)
