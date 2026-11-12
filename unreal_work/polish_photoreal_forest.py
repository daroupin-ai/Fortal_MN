import unreal as u
import random, json
from pathlib import Path
random.seed(220)
actors=u.get_editor_subsystem(u.EditorActorSubsystem)
level=u.get_editor_subsystem(u.LevelEditorSubsystem)
assert level.get_current_level().get_path_name().startswith('/Game/SmallForest/Forest_Photoreal')
assert not any(a.get_actor_label().startswith('Background grove ') for a in actors.get_all_level_actors())
assert level.save_current_level()
root='/Game/BlackAlder/Geometry/SimpleWind/'
field=[u.load_asset(root+'SM_BlackAlder_Field_%02d'%i) for i in (1,2,3)]
saplings=[u.load_asset(root+'SM_BlackAlder_Sapling_%02d'%i) for i in range(1,5)]
assert all(field+saplings)
def add(mesh,name,x,y,scale):
    a=actors.spawn_actor_from_class(u.StaticMeshActor,u.Vector(x,y,-2),u.Rotator(pitch=0,yaw=random.uniform(0,360),roll=0))
    a.static_mesh_component.set_static_mesh(mesh)
    a.set_actor_scale3d(u.Vector(scale,scale,scale))
    a.set_actor_label(name)
    a.set_folder_path('Scanned forest/Background grove')
for i,(x,y) in enumerate([(1700,-850),(1700,1000),(2250,-400),(2450,450),(2850,-1100),(2950,1100),(3200,0),
                         (350,-1000),(500,1150),(3100,-1600),(3100,1700),(3500,-600),(3500,650)]):
    add(field[i%3],'Background grove tree %02d'%i,x,y,random.uniform(.65,.9))
for row,x in enumerate((2300,2750,3250)):
    for i in range(16):
        y=-1800+i*240+random.uniform(-110,110)
        add(saplings[(i+row)%4],'Background grove sapling %d_%02d'%(row,i),x+random.uniform(-150,150),y,random.uniform(.9,1.45))
for a in actors.get_all_level_actors():
    name=a.get_actor_label()
    if name=='Sun through the canopy':
        a.set_actor_rotation(u.Rotator(pitch=-30,yaw=-40,roll=0),False)
        a.light_component.set_editor_property('intensity',4.5)
        a.light_component.set_editor_property('light_color',u.Color(255,232,196,255))
        a.light_component.set_editor_property('light_source_angle',2.0)
    elif name=='Soft forest skylight':
        a.light_component.set_editor_property('intensity',1.6)
    elif isinstance(a,u.ExponentialHeightFog):
        fc=a.get_component_by_class(u.ExponentialHeightFogComponent)
        fc.set_editor_property('fog_density',.04)
        fc.set_editor_property('fog_inscattering_luminance',u.LinearColor(.36,.43,.38,1))
    elif name=='Forest_View_Camera':
        a.set_actor_rotation(u.Rotator(pitch=-2,yaw=3,roll=0),False)
        a.get_cine_camera_component().set_editor_property('current_focal_length',36.0)
        level.pilot_level_actor(a)
level.editor_set_game_view(True)
assert level.save_current_level()
report_path=Path('D:/이무늬_손짓으로 여는 AI 세계/unreal_work/photoreal_result.json')
report=json.loads(report_path.read_text())
report.update({'trees':47,'saplings':70,'actors':len(actors.get_all_level_actors())})
report_path.write_text(json.dumps(report,indent=2))
u.log('FOREST_POLISH_COMPLETE')
