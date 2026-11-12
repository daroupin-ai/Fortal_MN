import bpy
import json
import math
import os
import sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

OUT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, OUT)
from car import build_car
from city import build_city

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = 'Downtown · 15 second sports car launch'
scene.unit_settings.system = 'METRIC'
build_city()
car, wheels = build_car()
scene.render.fps = 24
scene.render.fps_base = 1
scene.frame_start = 1
scene.frame_end = 360

def smoothstep(t):
    t = max(0, min(1, t))
    return t*t*(3-2*t)

def distance(t):
    if t <= 1.5:
        return 0.0
    if t < 6:
        u = (t-1.5)/4.5
        return 54*(u**3-.5*u**4)
    return 27+12*(t-6)

def car_position(t):
    sway = .30*math.sin((t-1.5)*.55)*smoothstep((t-1.5)/4)
    return Vector((2.7+sway, distance(t), 0))

cinematography = bpy.data.collections.new('Cinematography')
scene.collection.children.link(cinematography)
camera_data = bpy.data.cameras.new('Low chase · animated lens')
camera = bpy.data.objects.new('Chase_Camera', camera_data)
cinematography.objects.link(camera)
scene.camera = camera
camera.rotation_mode = 'QUATERNION'
camera_data.clip_start = .08
camera_data.clip_end = 500
camera_data.sensor_width = 36
camera_data.lens = 35
target = bpy.data.objects.new('Camera_Focus', None)
cinematography.objects.link(target)
camera_data.dof.use_dof = True
camera_data.dof.focus_object = target
camera_data.dof.aperture_fstop = 6.3
camera_data.dof.aperture_blades = 7

# A continuous front-quarter reveal becomes a side-tracking and rear chase shot.
camera_beats = [
    (0.0, (4.4, 7.2, .52), 35),
    (1.5, (4.2, 7.0, .60), 35),
    (4.0, (5.0, 6.0, .82), 34),
    (7.0, (6.6, 1.2, 1.08), 32),
    (10.5, (5.0, -6.5, 1.36), 35),
    (14.96, (4.5, -8.8, 1.85), 39),
]

def camera_offset(t):
    for i in range(len(camera_beats)-1):
        a, b = camera_beats[i:i+2]
        if t <= b[0]:
            u = smoothstep((t-a[0])/(b[0]-a[0]))
            return Vector(a[1]).lerp(Vector(b[1]),u), a[2]*(1-u)+b[2]*u
    return Vector(camera_beats[-1][1]),camera_beats[-1][2]

wheel_radius = .36
travel = 0
previous = car_position(0)
for frame in range(1, 361):
    t = (frame-1)/24
    position = car_position(t)
    travel += (position-previous).length
    previous = position.copy()
    car.location = position
    tangent = car_position(t+.02)-car_position(max(0,t-.02))
    yaw = -math.atan2(tangent.x,tangent.y) if tangent.length>.0001 else 0
    car.rotation_euler = (.009*math.sin(t*2)*smoothstep((t-1.5)/2),0,yaw)
    car.keyframe_insert('location',frame=frame)
    car.keyframe_insert('rotation_euler',frame=frame)
    for wheel in wheels:
        wheel.rotation_euler.x = -travel/wheel_radius
        wheel.keyframe_insert('rotation_euler',frame=frame)
    offset, lens = camera_offset(t)
    camera.location = position+offset
    focus = position+Vector((0,.25,.72))
    target.location = focus
    camera.rotation_quaternion = (focus-camera.location).to_track_quat('-Z','Y')
    camera.keyframe_insert('location',frame=frame)
    camera.keyframe_insert('rotation_quaternion',frame=frame)
    camera_data.lens = lens
    camera_data.keyframe_insert('lens',frame=frame)
    target.keyframe_insert('location',frame=frame)

for obj in [car,camera,camera_data,target,*wheels]:
    animation = obj.animation_data
    if animation and animation.action:
        bag = animation.action.layers[0].strips[0].channelbag(animation.action_slot)
        for curve in bag.fcurves:
            for key in curve.keyframe_points:
                key.interpolation = 'LINEAR'
for frame,name in [(1,'LOW ANGLE · 0s'),(37,'LAUNCH · 1.5s'),(145,'SIDE TRACK · 6s'),(253,'REAR CHASE · 10.5s'),(360,'END · 15s')]:
    scene.timeline_markers.new(name,frame=frame)

world = bpy.data.worlds.new('Wide Street 02 · HDRI')
world.use_nodes = True
scene.world = world
nodes = world.node_tree.nodes
links = world.node_tree.links
environment = nodes.new('ShaderNodeTexEnvironment')
environment.image = bpy.data.images.load(os.path.join(OUT,'assets','wide_street_02_2k.hdr'))
environment.image.pack()
mapping = nodes.new('ShaderNodeMapping')
mapping.inputs['Rotation'].default_value.z = math.radians(115)
coordinates = nodes.new('ShaderNodeTexCoord')
links.new(coordinates.outputs['Generated'],mapping.inputs['Vector'])
links.new(mapping.outputs['Vector'],environment.inputs['Vector'])
links.new(environment.outputs['Color'],nodes.get('Background').inputs['Color'])
nodes.get('Background').inputs['Strength'].default_value = 1.0
world['HDRI_source'] = 'https://polyhaven.com/a/wide_street_02'
world['HDRI_license'] = 'CC0 · Sergej Majboroda / Poly Haven'

sun_data = bpy.data.lights.new('Late afternoon key','SUN')
sun_data.energy = 2.7
sun_data.angle = math.radians(4)
sun_data.color = (1,.88,.73)
sun = bpy.data.objects.new('Late afternoon key',sun_data)
cinematography.objects.link(sun)
sun.rotation_euler = (math.radians(28),0,0)
# A broad travelling reflection gives the metallic body readable contours.
fill_data = bpy.data.lights.new('Bodywork reflection','AREA')
fill_data.energy = 420
fill_data.shape = 'RECTANGLE'
fill_data.size = 5
fill_data.size_y = 2
fill = bpy.data.objects.new('Bodywork reflection',fill_data)
cinematography.objects.link(fill)
fill.parent = car
fill.location = (-3,0,4.5)
fill.rotation_euler = (Vector((0,0,.6))-fill.location).to_track_quat('-Z','Y').to_euler()

scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'OPTIX'
prefs.get_devices()
for device in prefs.devices:
    device.use = device.type=='OPTIX'
scene.cycles.device = 'GPU'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.cycles.preview_samples = 16
scene.cycles.use_preview_denoising = True
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.render.use_motion_blur = True
scene.render.motion_blur_shutter = .28
scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = .6
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.render.filepath = os.path.join(OUT,'frames','city_')
scene['duration_seconds'] = 15
scene['animation_notes'] = '24 fps / 360 frames. 1.5s hold, smooth launch and accelerating drive. Continuous low front-quarter, side-tracking and rear-chase camera. Wheels rotate by ground distance.'
scene['design'] = 'Original unbranded metallic blue sports coupe; contemporary downtown; late-afternoon HDRI and sun.'

# Check the entire camera path and all animated components before saving.
samples=[]
for frame in range(1,361):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    projected=world_to_camera_view(scene,camera,car.matrix_world @ Vector((0,0,.65)))
    assert .08<projected.x<.92 and .08<projected.y<.92 and projected.z>0, (frame,projected[:])
    assert camera.location.z>=.5
    assert abs(camera.location.x)<10
    if frame in [1,37,120,216,360]:
        samples.append({'frame':frame,'car':list(car.location),'camera':list(camera.location),'wheel_angle':wheels[0].rotation_euler.x})
assert scene.frame_end/scene.render.fps==15
assert environment.image.packed_file
assert len(wheels)==4
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
car.select_set(True)
bpy.context.view_layer.objects.active = car
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective = 'CAMERA'
            area.spaces.active.region_3d.view_camera_zoom = 6
            area.spaces.active.overlay.show_overlays = False
            area.spaces.active.shading.type = 'MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'city_sportscar_15s.blend'))
with open(os.path.join(OUT,'verification.json'),'w',encoding='utf-8') as f:
    json.dump({'duration_seconds':15,'fps':24,'frames':360,'packed_hdri':True,'samples':samples},f,indent=2)
scene.render.resolution_percentage = 67
for frame in [1,168,336]:
    scene.frame_set(frame)
    scene.render.filepath = os.path.join(OUT,'preview_%03d.png'%frame)
    bpy.ops.render.render(write_still=True)
print('SCENE_READY',len(scene.objects))
