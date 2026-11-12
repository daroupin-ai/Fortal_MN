"""Build a compact scanned forest floor, preserving the first forest map."""
import json, math, random
from pathlib import Path
import unreal as u

WORK = Path('D:/이무늬_손짓으로 여는 AI 세계/unreal_work')
data = json.loads((WORK/'megascans_import_result.json').read_text())
assets = u.get_editor_subsystem(u.EditorAssetSubsystem)
level = u.get_editor_subsystem(u.LevelEditorSubsystem)
actors = u.get_editor_subsystem(u.EditorActorSubsystem)
MAP = '/Game/SmallForest/Forest_Photoreal'
assert not assets.does_asset_exist(MAP), 'Map already exists: inspect instead of overwriting.'
assert level.save_current_level()
assert level.new_level(MAP)
random.seed(83)
terrain = u.load_asset(data['Terrain']['meshes'][0]['path'])
rock = u.load_asset(data['Rock']['meshes'][0]['path'])
ferns = [u.load_asset(x['path']) for x in data['Fern']['meshes']]
assert terrain and rock and all(ferns)

def spawn(mesh, name, xyz, scale=(1,1,1), yaw=0, folder='Scanned forest'):
    a = actors.spawn_actor_from_class(u.StaticMeshActor, u.Vector(*xyz), u.Rotator(pitch=0,yaw=yaw,roll=0))
    a.static_mesh_component.set_static_mesh(mesh)
    a.set_actor_scale3d(u.Vector(*scale))
    a.set_actor_label(name)
    a.set_folder_path(folder)
    return a

# A tiled scan fills small seams beneath the irregular scanned ground pieces.
matpath = '/Game/SmallForest/Megascans/Terrain/M_GroundTiled'
mat = assets.duplicate_asset(data['Terrain']['material'].split('.')[0], matpath)
assert mat
coord = u.MaterialEditingLibrary.create_material_expression(mat, u.MaterialExpressionTextureCoordinate, -700, 0)
coord.set_editor_property('u_tiling', 16.0)
coord.set_editor_property('v_tiling', 14.0)
for expression in u.MaterialEditingLibrary.get_material_expressions(mat):
    if isinstance(expression, u.MaterialExpressionTextureSample):
        u.MaterialEditingLibrary.connect_material_expressions(coord, '', expression, 'Coordinates')
u.MaterialEditingLibrary.recompile_material(mat)
base = spawn(u.load_asset('/Engine/BasicShapes/Plane'), 'Scanned soil underlay', (450,0,-8), (36,30,1))
base.static_mesh_component.set_material(0,mat)

for ix in range(20):
    for iy in range(13):
        x=-1050+ix*165+random.uniform(-10,10)
        y=-1320+iy*220+random.uniform(-12,12)
        s=random.uniform(1.09,1.16)
        spawn(terrain, 'Scanned ground %02d_%02d'%(ix,iy), (x,y,-5+random.uniform(-2,2)), (s,s,.7), random.choice((0,180)), 'Scanned forest/Ground')

def center(x):
    return 105*math.sin((x+650)/650)

for i in range(190):
    x=random.uniform(-950,2100)
    y=center(x)+random.choice((-1,1))*random.uniform(130,1250)
    s=random.uniform(.38,.85)
    spawn(random.choice(ferns), 'Fern %03d'%i, (x,y,0), (s,s,s), random.uniform(0,360), 'Scanned forest/Ferns')
for i in range(24):
    x=random.uniform(-750,2150)
    y=center(x)+random.choice((-1,1))*random.uniform(140,1250)
    s=random.uniform(.6,1.5)
    spawn(rock, 'Mossy forest rock %02d'%i, (x,y,-3), (s,s,s), random.uniform(0,360), 'Scanned forest/Rocks')
spawn(rock, 'Foreground mossy rock', (-420,-245,-2), (1.45,1.45,1.45), 37, 'Scanned forest/Rocks')

sun=actors.spawn_actor_from_class(u.DirectionalLight, u.Vector(0,0,1000), u.Rotator(pitch=-38,yaw=-38,roll=0))
sun.set_actor_label('Sun through the canopy')
sun.light_component.set_editor_property('intensity',4.0)
sun.light_component.set_editor_property('light_color',u.Color(255,237,208,255))
sun.light_component.set_editor_property('light_source_angle',1.4)
sun.light_component.set_editor_property('volumetric_scattering_intensity',1.0)
sun.set_folder_path('Lighting')
sky=actors.spawn_actor_from_class(u.SkyLight,u.Vector(0,0,1000))
sky.set_actor_label('Soft forest skylight')
sky.light_component.set_editor_property('real_time_capture',True)
sky.light_component.set_editor_property('intensity',.9)
sky.set_folder_path('Lighting')
actors.spawn_actor_from_class(u.SkyAtmosphere,u.Vector()).set_folder_path('Lighting')
fog=actors.spawn_actor_from_class(u.ExponentialHeightFog,u.Vector(0,0,-50))
fog.set_folder_path('Lighting')
fc=fog.get_component_by_class(u.ExponentialHeightFogComponent)
fc.set_editor_property('fog_density',.012)
fc.set_editor_property('fog_height_falloff',.28)
fc.set_editor_property('enable_volumetric_fog',True)
post=actors.spawn_actor_from_class(u.PostProcessVolume,u.Vector())
post.set_actor_label('Natural forest exposure')
post.set_folder_path('Lighting')
post.set_editor_property('unbound',True)
ps=post.get_editor_property('settings')
for key,value in [('override_auto_exposure_method',True),('auto_exposure_method',u.AutoExposureMethod.AEM_MANUAL),
                  ('override_auto_exposure_bias',True),('auto_exposure_bias',.5),
                  ('override_auto_exposure_apply_physical_camera_exposure',True),('auto_exposure_apply_physical_camera_exposure',False)]:
    ps.set_editor_property(key,value)
post.set_editor_property('settings',ps)
camera=actors.spawn_actor_from_class(u.CineCameraActor,u.Vector(-1050,0,165),u.Rotator(pitch=-3,yaw=0,roll=0))
camera.set_actor_label('Forest_View_Camera')
camera.set_folder_path('Camera')
cc=camera.get_cine_camera_component()
cc.set_editor_property('current_focal_length',30.0)
cc.set_editor_property('current_aperture',8.0)
film=cc.get_editor_property('filmback')
film.set_editor_property('sensor_width',36.0)
film.set_editor_property('sensor_height',20.25)
cc.set_editor_property('filmback',film)
focus=cc.get_editor_property('focus_settings')
focus.set_editor_property('focus_method',u.CameraFocusMethod.DISABLE)
cc.set_editor_property('focus_settings',focus)
level.pilot_level_actor(camera)
level.editor_set_game_view(True)
assets.save_loaded_asset(mat)
assert level.save_current_level()
(WORK/'photoreal_ground_result.json').write_text(json.dumps({'map':MAP,'actors':len(actors.get_all_level_actors()),'trees_pending':True}))
u.log('PHOTOREAL_GROUND_COMPLETE')
