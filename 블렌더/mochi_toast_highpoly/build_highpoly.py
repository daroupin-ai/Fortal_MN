import bpy
import math
import os
import sys
import json
import numpy as np
from mathutils import Vector

OUT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, OUT)
from bread import build_bread

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
rng = np.random.default_rng(814)
character = bpy.data.collections.new('Mochi · realistic hamster')
scene.collection.children.link(character)
root = bpy.data.objects.new('Mochi_Character · move this', None)
character.objects.link(root)
root.empty_display_type = 'PLAIN_AXES'
root.empty_display_size = .3

def attach(obj):
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    character.objects.link(obj)
    obj.parent = root
    return obj

def material(name, color, roughness=.5, subsurface=0, micro=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1)
    nodes = mat.node_tree.nodes
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Subsurface Weight'].default_value = subsurface
    shader.inputs['Subsurface Radius'].default_value = (1,.45,.25)
    shader.inputs['Subsurface Scale'].default_value = .04
    if micro:
        tex = nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = 180
        tex.inputs['Detail'].default_value = 3
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .25
        bump.inputs['Distance'].default_value = micro
        mat.node_tree.links.new(tex.outputs['Fac'], bump.inputs['Height'])
        mat.node_tree.links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    return mat

skin = material('Soft pink skin · pores',(.58,.255,.205),.48,.28,.006)
ear_skin = material('Translucent ear skin',(.46,.245,.17),.58,.32,.004)
ear_coat = material('Ear outer skin and fine fuzz',(.37,.225,.12),.76,.06,.008)
nose_skin = material('Nose · warm rose',(.51,.17,.125),.38,.23,.006)
claw_mat = material('Tiny ivory claws',(.69,.56,.40),.32,.05)
lip_mat = material('Lip and nostril shadow',(.105,.042,.025),.55)
eye_mat = material('Eyes · deep brown cornea',(.007,.0035,.0018),.095)
iris_mat = material('Eye rim · deep umber',(.035,.014,.005),.26)
base_coat = material('Coat underfur',(.38,.23,.11),.82)

def ellipsoid(name, center, size, mat, segments=64, rings=40):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    attach(obj)
    return obj

parts = []
for name, center, size in [
    ('Body',(0,.24,.98),(.95,.79,.60)),
    ('Head',(0,-.22,1.26),(1.02,.69,.64)),
    ('Left cheek',(-.48,-.51,1.03),(.60,.49,.43)),
    ('Right cheek',(.48,-.51,1.03),(.60,.49,.43)),
    ('Chin',(0,-.56,.84),(.68,.44,.30)),
    ('Left muzzle',(-.14,-.89,1.10),(.25,.20,.21)),
    ('Right muzzle',(.14,-.89,1.10),(.25,.20,.21)),
]:
    parts.append(ellipsoid(name,center,size,base_coat))
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.object
body.name = 'Mochi · sculpted continuous body'
remesh = body.modifiers.new('Continuous organic skin','REMESH')
remesh.mode = 'VOXEL'
remesh.voxel_size = .017
remesh.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier=remesh.name)
smooth = body.modifiers.new('Soft cheek transitions','SMOOTH')
smooth.factor = 1.2
smooth.iterations = 14
bpy.ops.object.modifier_apply(modifier=smooth.name)
sub = body.modifiers.new('Fine sculpt surface','SUBSURF')
sub.levels = 1
bpy.ops.object.modifier_apply(modifier=sub.name)
for polygon in body.data.polygons:
    polygon.use_smooth = True

def white_probability(points):
    x,y,z = points.T
    cheek = 1/(1+np.exp(np.clip((z-1.17-.13*np.abs(x))*20,-60,60)))
    bridge = np.exp(-x*x/.025)/(1+np.exp(np.clip((z-1.48)*22,-60,60)))
    front = 1/(1+np.exp(np.clip((y+.35)*15,-60,60)))
    belly = 1/(1+np.exp(np.clip((z-.77)*18,-60,60)))
    return np.clip(np.maximum(np.maximum(cheek,bridge)*front,belly),0,1)

vertices = np.array([body.matrix_world @ v.co for v in body.data.vertices])
white = white_probability(vertices)
coat_color = body.data.color_attributes.new(name='CoatColor',type='FLOAT_COLOR',domain='POINT')
gold_rgb = np.array([.39,.235,.105])
ivory_rgb = np.array([.73,.64,.50])
colors = np.ones((len(vertices),4),dtype=np.float32)
colors[:,:3] = gold_rgb[None,:]*(1-white[:,None])+ivory_rgb[None,:]*white[:,None]
coat_color.data.foreach_set('color',colors.ravel())
attribute = base_coat.node_tree.nodes.new('ShaderNodeVertexColor')
attribute.layer_name='CoatColor'
base_coat.node_tree.links.new(attribute.outputs['Color'],base_coat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

def hair_material(name,color):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    nodes=mat.node_tree.nodes
    nodes.clear()
    shader=nodes.new('ShaderNodeBsdfHairPrincipled')
    shader.parametrization='COLOR'
    shader.inputs['Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=.39
    shader.inputs['Radial Roughness'].default_value=.5
    output=nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(shader.outputs[0],output.inputs[0])
    return mat

fur_gold=hair_material('Fur · golden sable',(.38,.235,.115))
fur_light=hair_material('Fur · warm golden tips',(.59,.43,.26))
fur_white=hair_material('Fur · cream and ivory',(.79,.70,.57))
fur_dark=hair_material('Fur · sparse dark guard hairs',(.12,.065,.027))

body.data.calc_loop_triangles()
triangles=np.array([t.vertices for t in body.data.loop_triangles])
tri=vertices[triangles]
cross=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])
areas=np.linalg.norm(cross,axis=1)/2
indices=rng.choice(len(tri),size=215000,p=areas/areas.sum())
chosen=tri[indices]
u=rng.random(len(indices))
v=rng.random(len(indices))
sqrt_u=np.sqrt(u)
positions=(1-sqrt_u[:,None])*chosen[:,0]+(sqrt_u*(1-v))[:,None]*chosen[:,1]+(sqrt_u*v)[:,None]*chosen[:,2]
normals=cross[indices]/np.linalg.norm(cross[indices],axis=1)[:,None]
# Keep the eyes and nostrils clear of coat strands.
visible=np.ones(len(positions),dtype=bool)
for sign in [-1,1]:
    dx=(positions[:,0]-sign*.39)/.141
    dz=(positions[:,2]-1.44)/.160
    visible &= ~((dx*dx+dz*dz<1.12)&(positions[:,1]<-.77))
visible &= ~((positions[:,0]**2/.12**2+(positions[:,2]-1.13)**2/.095**2<1.15)&(positions[:,1]<-1.01))
positions=positions[visible]
normals=normals[visible]
probability=white_probability(positions)
types=np.where(rng.random(len(positions))<probability,2,np.where(rng.random(len(positions))<.38,1,0))
guard=(rng.random(len(positions))<.012)&(types!=2)
types[guard]=3
white_guard=(rng.random(len(positions))<.018)&(types==2)
types[white_guard]=4

def hair_object(name,positions,normals,mat,guard=False):
    count=len(positions)
    x,y,z=positions.T
    direction=np.column_stack((x*.70,np.full(count,.15),np.full(count,-.10)))
    front=y<-.45
    direction[front]=np.column_stack((x[front]*1.5,np.full(front.sum(),-.02),(z[front]-1.20)*.55-.08))
    tangent=direction-np.sum(direction*normals,axis=1)[:,None]*normals
    tangent/=np.maximum(np.linalg.norm(tangent,axis=1)[:,None],.001)
    lengths=rng.uniform(.035,.064,count)
    lengths += .025*np.clip(np.abs(x)-.4,0,.7)
    if guard:
        lengths*=1.7
    curl=rng.normal(0,.16,(count,3))
    t=np.linspace(0,1,6)[None,:,None]
    points=positions[:,None,:]+lengths[:,None,None]*(normals[:,None,:]*(t-.22*t*t)+tangent[:,None,:]*(.6*t*t)+curl[:,None,:]*(t*t*.2))
    curves=bpy.data.hair_curves.new(name)
    curves.add_curves([6]*count)
    curves.attributes['position'].data.foreach_set('vector',points.astype(np.float32).ravel())
    radius=curves.attributes.new('radius','FLOAT','POINT')
    root_radius=.0014 if guard else .00165
    radii=root_radius*(1-np.linspace(0,1,6)**1.3)+.00008
    radius.data.foreach_set('value',np.tile(radii,count).astype(np.float32))
    obj=bpy.data.objects.new(name,curves)
    character.objects.link(obj)
    obj.parent=root
    curves.materials.append(mat)
    obj['strand_count']=count
    return obj

for kind,mat in enumerate([fur_gold,fur_light,fur_white,fur_dark,fur_white]):
    mask=types==kind
    hair_object('Mochi · groomed fur '+str(kind),positions[mask],normals[mask],mat,kind>=3)

def path(name,points,radii,mat):
    curve=bpy.data.curves.new(name,'CURVE')
    curve.dimensions='3D'
    curve.resolution_u=16
    curve.bevel_depth=1
    curve.bevel_resolution=3
    spline=curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for p,co,radius in zip(spline.bezier_points,points,radii):
        p.co=co
        p.radius=radius
        p.handle_left_type='AUTO'
        p.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,curve)
    character.objects.link(obj)
    obj.parent=root
    curve.materials.append(mat)
    return obj

for sign in [-1,1]:
    ellipsoid('Ear · furry outer rim',(sign*.75,.015,1.74),(.24,.12,.275),ear_coat)
    ellipsoid('Ear · pink fold',(sign*.75,-.083,1.76),(.17,.048,.20),ear_skin)
    ellipsoid('Eye · wet lash line',(sign*.39,-.858,1.44),(.139,.095,.159),iris_mat)
    ellipsoid('Eye · glossy cornea',(sign*.39,-.88,1.44),(.132,.095,.152),eye_mat,80,56)
    paw=ellipsoid('Front paw',(sign*.38,-.88,.555),(.158,.21,.10),skin)
    for i in range(4):
        px=sign*.38+(i-1.5)*.067
        py=-1.055+.035*abs(i-1.5)
        ellipsoid('Curled finger',(px,py,.535),(.043,.09,.058),skin,32,24)
        nail=ellipsoid('Small nail',(px,py-.064,.535),(.010,.025,.007),claw_mat,24,16)
        path('Finger crease',[(px-.023,py-.015,.581),(px,py-.025,.588),(px+.023,py-.015,.581)],[.001,.0015,.001],nose_skin)
    ellipsoid('Back paw',(sign*.65,.55,.52),(.21,.29,.12),skin)
    for i in range(7):
        z=1.08+(i-3)*.036
        jitter=float(rng.uniform(-.02,.02))
        path('Fine whisker',[(sign*.24,-1.06,z),(sign*.65,-1.16,z+(i-3)*.035),(sign*(1.18+abs(i-3)*.025),-1.10+jitter,z+(i-3)*.08)],[.003,.0018,.00012],fur_light)
    for i in range(2):
        path('Brow whisker',[(sign*.47,-.80,1.63),(sign*.61,-.85,1.77),(sign*.76,-.84,1.81+i*.07)],[.002,.001,.0001],fur_gold)

nose=ellipsoid('Nose · soft triangular tip',(0,-1.107,1.135),(.115,.075,.080),nose_skin)
for vertex in nose.data.vertices:
    if vertex.co.z<0:
        vertex.co.x*=.30+.70*(vertex.co.z/.08+1)
for sign in [-1,1]:
    ellipsoid('Nostril',(sign*.073,-1.153,1.128),(.008,.005,.009),lip_mat,24,16)
path('Philtrum',[(0,-1.105,1.075),(0,-1.095,1.015)],[.006,.004],lip_mat)
for sign in [-1,1]:
    path('Natural mouth line',[(0,-1.095,1.015),(sign*.075,-1.077,.982),(sign*.115,-1.057,.99)],[.004,.004,.001],lip_mat)
ellipsoid('Tail',(0,.98,.77),(.10,.18,.105),skin)

bottom,top=build_bread()
bread_collection=bpy.data.collections.new('Bread · independent slices')
scene.collection.children.link(bread_collection)
for obj in [bottom,top]:
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    bread_collection.objects.link(obj)

studio=bpy.data.collections.new('Studio')
scene.collection.children.link(studio)
floor_mat=material('Warm neutral backdrop',(.35,.295,.23),.86)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025))
floor=bpy.context.object
floor.name='Studio floor'
floor.data.materials.append(floor_mat)
for collection in list(floor.users_collection):
    collection.objects.unlink(floor)
studio.objects.link(floor)

def aim(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

for name,location,power,size,color in [
    ('Large window',(-3,-4,6),520,4,(1,.87,.73)),
    ('Soft fill',(3,-2,3),200,3,(.78,.87,1)),
    ('Rim softbox',(1,3,5),650,3,(1,.88,.72)),
]:
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.shape='DISK'
    data.size=size
    data.color=color
    obj=bpy.data.objects.new(name,data)
    studio.objects.link(obj)
    obj.location=location
    aim(obj,(0,0,1))
data=bpy.data.cameras.new('Portrait camera')
camera=bpy.data.objects.new('Portrait camera',data)
studio.objects.link(camera)
camera.location=(.18,-8.8,3.25)
aim(camera,(0,-.1,1.12))
data.type='ORTHO'
data.ortho_scale=4.15
scene.camera=camera
scene.world=bpy.data.worlds.new('Soft daylight')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.68,.77,.90,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.22
scene.render.engine='CYCLES'
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='OPTIX'
prefs.get_devices()
for device in prefs.devices:
    device.use=device.type=='OPTIX'
scene.cycles.device='GPU'
scene.cycles.samples=96
scene.cycles.use_denoising=True
scene.cycles.preview_samples=16
scene.render.resolution_x=1300
scene.render.resolution_y=1200
scene.render.resolution_percentage=int(os.environ.get('MOCHI_RENDER_PERCENT','100'))
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.filepath=os.path.join(OUT,'mochi_highpoly_preview.png')
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
bpy.context.view_layer.objects.active=root
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active
            space.overlay.show_overlays=False
            space.region_3d.view_perspective='CAMERA'
            space.region_3d.view_camera_zoom=4
            space.shading.type='MATERIAL'
scene['notes']='Photographic reference interpreted as a golden hamster. Character parent and two bread meshes independently movable. Dense groomed curves and procedural microtextures included.'
manifest={'fur_strands':int(len(positions)),'character_parent':root.name,'bread_objects':[bottom.name,top.name],'body_faces':len(body.data.polygons)}
with open(os.path.join(OUT,'asset_info.json'),'w',encoding='utf-8') as f:
    json.dump(manifest,f,ensure_ascii=False,indent=2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'mochi_highpoly.blend'))
bpy.ops.render.render(write_still=True)
print('ASSET_CHECK',manifest)
