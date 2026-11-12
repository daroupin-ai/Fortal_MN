"""A small camera-facing woodland made only with Unreal's built-in shapes."""
import json
import math
import random
from pathlib import Path
import unreal as u

random.seed(27)
ROOT = '/Game/SmallForest'
MAP = ROOT + '/Forest_CameraView'
assets = u.get_editor_subsystem(u.EditorAssetSubsystem)
level = u.get_editor_subsystem(u.LevelEditorSubsystem)
actors = u.get_editor_subsystem(u.EditorActorSubsystem)
assert not assets.does_asset_exist(MAP), 'Forest already exists; inspect before changing it.'
assert level.save_current_level(), 'Existing level could not be saved.'
assert level.new_level(MAP), 'Could not create the separate forest level.'
tools = u.AssetToolsHelpers.get_asset_tools()
created_materials = []


def material(name, rgb):
    m = tools.create_asset(name, ROOT + '/Materials', u.Material, u.MaterialFactoryNew())
    assert m, name
    color = u.MaterialEditingLibrary.create_material_expression(m, u.MaterialExpressionConstant3Vector)
    color.set_editor_property('constant', u.LinearColor(*rgb, 1))
    u.MaterialEditingLibrary.connect_material_property(color, '', u.MaterialProperty.MP_BASE_COLOR)
    rough = u.MaterialEditingLibrary.create_material_expression(m, u.MaterialExpressionConstant)
    rough.set_editor_property('r', 0.88)
    u.MaterialEditingLibrary.connect_material_property(rough, '', u.MaterialProperty.MP_ROUGHNESS)
    u.MaterialEditingLibrary.recompile_material(m)
    created_materials.append(m)
    return m


soil = material('M_ForestFloor', (0.055, 0.091, 0.036))
path_mat = material('M_WarmEarth', (0.19, 0.128, 0.065))
bark = material('M_Bark', (0.12, 0.063, 0.028))
pine = [material('M_Needles_' + str(i), col) for i, col in enumerate([
    (0.026, 0.10, 0.07), (0.042, 0.155, 0.083), (0.087, 0.22, 0.095)])]
moss = material('M_Moss', (0.16, 0.23, 0.052))
rock = material('M_Stone', (0.22, 0.245, 0.22))
grass = material('M_Grass', (0.13, 0.24, 0.054))
shapes = {n: u.load_asset('/Engine/BasicShapes/' + n) for n in ('Cube', 'Sphere', 'Cylinder', 'Cone')}
assert all(shapes.values())


def mesh(name, shape, xyz, scale, mat, folder, rotation=None):
    a = actors.spawn_actor_from_class(u.StaticMeshActor, u.Vector(*xyz), rotation or u.Rotator())
    a.set_actor_label(name)
    a.set_folder_path(folder)
    c = a.static_mesh_component
    c.set_static_mesh(shapes[shape])
    c.set_material(0, mat)
    a.set_actor_scale3d(u.Vector(*scale))
    return a


# Only 24 x 22 metres of set, entirely in front of the camera.
mesh('Forest floor - compact set', 'Cube', (750, 0, -48), (24, 22, 0.9), soil, 'Ground')
for i in range(20):
    x = -410 + i * 116
    y = 110 * math.sin((x + 120) / 510)
    mesh('Footpath_%02d' % i, 'Sphere', (x, y, -7), (2.65, 2.15 - i * 0.024, 0.22), path_mat, 'Ground/Path')

tree_positions = [(-230,-430),(-120,410),(150,-680),(230,490),(450,-360),(520,790),
                  (710,-760),(800,410),(960,-440),(1110,760),(1300,-790),(1390,400),
                  (1600,-410),(1700,690),(1850,-850),(1890,-140),(1850,270),
                  (1800,950),(1130,-1030),(420,-1010),(680,1050),(1400,1060)]
for i, (x, y) in enumerate(tree_positions):
    height = random.uniform(540, 850)
    width = random.uniform(170, 240)
    folder = 'Trees/Pine_%02d' % (i + 1)
    mesh('Pine_%02d_Trunk' % i, 'Cylinder', (x, y, height * .34), (.35, .35, height * .0068), bark, folder)
    for tier in range(4):
        diameter = width * (1.0 - tier * .18)
        z = height * (.36 + tier * .145)
        mesh('Pine_%02d_Crown_%d' % (i, tier), 'Cone', (x, y, z),
             (diameter / 50, diameter / 50, height * .0043), pine[(i + tier) % 3], folder)

# Rounded stones, moss and grass stay close to the visible path.
for i in range(26):
    x = random.uniform(-350, 1790)
    y = random.choice((-1, 1)) * random.uniform(180, 850)
    s = random.uniform(.45, 1.35)
    mesh('Stone_%02d' % i, 'Sphere', (x, y, s * 19), (s * 1.6, s, s * .7), rock,
         'Ground/Stones', u.Rotator(0, random.uniform(0, 180), 0))
    if i % 3 == 0:
        mesh('Moss_%02d' % i, 'Sphere', (x-7, y+3, s * 43), (s * 1.3, s * .84, s * .17), moss, 'Ground/Moss')
for i in range(55):
    x = random.uniform(-350, 1750)
    center = 110 * math.sin((x + 120) / 510)
    y = center + random.choice((-1, 1)) * random.uniform(130, 580)
    s = random.uniform(.18, .42)
    mesh('Grass_%02d' % i, 'Cone', (x, y, s * 40), (s * .65, s * .65, s), grass, 'Ground/Grass')

# A fallen branch adds a small foreground detail without new assets.
mesh('Fallen timber', 'Cylinder', (40,-280,30), (.55,.55,3.4), bark, 'Ground/Details', u.Rotator(0,25,90))

sun = actors.spawn_actor_from_class(u.DirectionalLight, u.Vector(1000,500,1000), u.Rotator(-29,-135,0))
sun.set_actor_label('Warm morning sunlight')
sun.set_folder_path('Lighting')
sun.light_component.set_editor_property('intensity', 5.0)
sun.light_component.set_editor_property('light_color', u.Color(255,225,174,255))
sun.light_component.set_editor_property('light_source_angle', 3.0)
sun.light_component.set_editor_property('volumetric_scattering_intensity', 1.1)
sky = actors.spawn_actor_from_class(u.SkyLight, u.Vector(0,0,700))
sky.set_actor_label('Soft sky fill')
sky.set_folder_path('Lighting')
sky.light_component.set_editor_property('real_time_capture', True)
sky.light_component.set_editor_property('intensity', .7)
atmosphere = actors.spawn_actor_from_class(u.SkyAtmosphere, u.Vector())
atmosphere.set_folder_path('Lighting')
fog = actors.spawn_actor_from_class(u.ExponentialHeightFog, u.Vector(0,0,20))
fog.set_actor_label('Gentle forest mist')
fog.set_folder_path('Lighting')
fc = fog.get_component_by_class(u.ExponentialHeightFogComponent)
fc.set_editor_property('fog_density', .035)
fc.set_editor_property('fog_height_falloff', .3)
fc.set_editor_property('fog_inscattering_luminance', u.LinearColor(.32,.43,.38,1))
fc.set_editor_property('enable_volumetric_fog', True)

post = actors.spawn_actor_from_class(u.PostProcessVolume, u.Vector())
post.set_actor_label('Forest exposure')
post.set_folder_path('Lighting')
post.set_editor_property('unbound', True)
ps = post.get_editor_property('settings')
ps.set_editor_property('override_auto_exposure_method', True)
ps.set_editor_property('auto_exposure_method', u.AutoExposureMethod.AEM_MANUAL)
ps.set_editor_property('override_auto_exposure_bias', True)
ps.set_editor_property('auto_exposure_bias', 0.0)
ps.set_editor_property('override_auto_exposure_apply_physical_camera_exposure', True)
ps.set_editor_property('auto_exposure_apply_physical_camera_exposure', False)
post.set_editor_property('settings', ps)

camera = actors.spawn_actor_from_class(u.CineCameraActor, u.Vector(-1000,0,255), u.Rotator(-3,0,0))
camera.set_actor_label('Forest_View_Camera')
camera.set_folder_path('Camera')
cc = camera.get_cine_camera_component()
cc.set_editor_property('current_focal_length', 27.0)
cc.set_editor_property('current_aperture', 8.0)
focus = cc.get_editor_property('focus_settings')
focus.set_editor_property('focus_method', u.CameraFocusMethod.DISABLE)
cc.set_editor_property('focus_settings', focus)
film = cc.get_editor_property('filmback')
film.set_editor_property('sensor_width', 36.0)
film.set_editor_property('sensor_height', 20.25)
cc.set_editor_property('filmback', film)
actors.set_selected_level_actors([])
level.pilot_level_actor(camera)
level.editor_set_game_view(True)
assert assets.save_loaded_assets(created_materials)
assert level.save_current_level()
report = {'map': MAP, 'camera': camera.get_actor_label(), 'trees':len(tree_positions),
          'actors':len(actors.get_all_level_actors()), 'source':'Unreal Engine built-in BasicShapes; original material colors',
          'paid_generation':False, 'original_level':'/Game/DemoTemplate/_Core/Lvl_IntroRoom'}
Path(__file__).with_name('forest_result.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
u.log('SMALL_FOREST_COMPLETE ' + json.dumps(report))
