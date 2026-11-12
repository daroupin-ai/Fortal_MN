import unreal as u
import random, json
from pathlib import Path
random.seed(94)
actors=u.get_editor_subsystem(u.EditorActorSubsystem)
details=[]
for a in actors.get_all_level_actors():
    name=a.get_actor_label()
    if name.startswith(('Scanned ground','Fern ','Mossy forest rock')) or name=='Foreground mossy rock':
        yaw=random.choice((0,180)) if name.startswith('Scanned ground') else random.uniform(0,360)
        a.set_actor_rotation(u.Rotator(pitch=0,yaw=yaw,roll=0),False)
    if name=='Sun through the canopy':
        a.set_actor_rotation(u.Rotator(pitch=-38,yaw=-38,roll=0),False)
    if name=='Forest_View_Camera':
        a.set_actor_rotation(u.Rotator(pitch=-3,yaw=0,roll=0),False)
    if isinstance(a,u.StaticMeshActor) and name in ('Scanned ground 00_00','Fern 000','Mossy forest rock 00'):
        b=a.static_mesh_component.static_mesh.get_bounds()
        details.append({'name':name,'origin':str(b.origin),'extent':str(b.box_extent)})
u.get_editor_subsystem(u.LevelEditorSubsystem).save_current_level()
Path('D:/이무늬_손짓으로 여는 AI 세계/unreal_work/ground_bounds.json').write_text(json.dumps(details))
exec(Path('D:/이무늬_손짓으로 여는 AI 세계/unreal_work/capture_forest.py').read_text(encoding='utf-8'))
