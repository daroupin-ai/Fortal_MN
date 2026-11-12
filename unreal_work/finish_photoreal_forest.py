"""Dress the camera-facing forest with the downloaded Quixel alder trees."""
import unreal as u
import json, random, math
from pathlib import Path
WORK=Path('D:/이무늬_손짓으로 여는 AI 세계/unreal_work')
level=u.get_editor_subsystem(u.LevelEditorSubsystem)
actors=u.get_editor_subsystem(u.EditorActorSubsystem)
assets=u.get_editor_subsystem(u.EditorAssetSubsystem)
assert level.get_current_level().get_path_name().startswith('/Game/SmallForest/Forest_Photoreal'), 'Wrong map'
assert not any(a.get_actor_label().startswith('Alder tree ') for a in actors.get_all_level_actors()), 'Trees already placed'
assert level.save_current_level()
root='/Game/BlackAlder/Geometry/SimpleWind/'
trees=[u.load_asset(root+'SM_BlackAlder_Forest_%02d'%i) for i in range(1,7)]
saplings=[u.load_asset(root+'SM_BlackAlder_Sapling_%02d'%i) for i in range(1,5)]
assert all(trees+saplings)
random.seed(142)

def spawn(mesh,name,x,y,scale,folder):
    a=actors.spawn_actor_from_class(u.StaticMeshActor,u.Vector(x,y,0),u.Rotator(pitch=0,yaw=random.uniform(0,360),roll=0))
    a.static_mesh_component.set_static_mesh(mesh)
    a.set_actor_scale3d(u.Vector(scale,scale,scale))
    a.set_actor_label(name)
    a.set_folder_path(folder)
    return a

positions=[(-550,-390),(-260,420),(120,-650),(100,690),(420,-360),(560,520),
           (870,-520),(1100,380),(1380,-340),(1600,510),(1880,-540),(2150,70)]
for x in (-350,180,760,1320,1910,2470):
    positions.extend([(x+random.uniform(-100,100),-1050+random.uniform(-180,80)),
                      (x+random.uniform(-100,100),1050+random.uniform(-80,180))])
for y in range(-1700,1800,350):
    positions.append((2850+random.uniform(-220,220),y))
for i,(x,y) in enumerate(positions):
    spawn(trees[i%len(trees)],'Alder tree %02d'%i,x,y,random.uniform(.70,.95),'Scanned forest/Alder trees')
for i in range(22):
    x=random.uniform(-300,2700)
    y=random.choice((-1,1))*random.uniform(260,1550)
    spawn(saplings[i%4],'Alder sapling %02d'%i,x,y,random.uniform(.60,1.0),'Scanned forest/Understory')

data=json.loads((WORK/'megascans_import_result.json').read_text())
ferns=[u.load_asset(x['path']) for x in data['Fern']['meshes'][:5]]
for i in range(270):
    x=random.uniform(-650,2500)
    middle=105*math.sin((x+650)/650)
    y=middle+random.choice((-1,1))*random.uniform(130,1450)
    spawn(random.choice(ferns),'Full fern %03d'%i,x,y,random.uniform(.7,1.15),'Scanned forest/Ferns')

for a in actors.get_all_level_actors():
    name=a.get_actor_label()
    if name.startswith('Scanned ground'):
        s=a.get_actor_scale3d()
        a.set_actor_scale3d(u.Vector(s.x*1.07,s.y*1.07,.35))
        p=a.get_actor_location()
        a.set_actor_location(u.Vector(p.x,p.y,-2),False,False)
    elif name=='Scanned soil underlay':
        a.set_actor_scale3d(u.Vector(52,40,1))
        a.set_actor_location(u.Vector(1000,0,-4),False,False)
    elif name=='Soft forest skylight':
        a.light_component.set_editor_property('intensity',1.3)
    elif name=='Natural forest exposure':
        ps=a.get_editor_property('settings')
        ps.set_editor_property('auto_exposure_bias',1.0)
        a.set_editor_property('settings',ps)
    elif name=='Forest_View_Camera':
        a.set_actor_location(u.Vector(-920,0,160),False,False)
        a.set_actor_rotation(u.Rotator(pitch=1,yaw=0,roll=0),False)
        a.get_cine_camera_component().set_editor_property('current_focal_length',30.0)
        level.pilot_level_actor(a)
level.editor_set_game_view(True)
actors.set_selected_level_actors([])
assert level.save_current_level()
report={'map':'/Game/SmallForest/Forest_Photoreal','trees':len(positions),'saplings':22,'ferns':460,
        'actors':len(actors.get_all_level_actors()),'assets':'Free Quixel Megascans from Fab',
        'tree_bounds':[{'name':m.get_name(),'extent':str(m.get_bounds().box_extent)} for m in trees],
        'paid_assets':False,'preview_pending':True}
(WORK/'photoreal_result.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
u.log('PHOTOREAL_FOREST_COMPLETE')
