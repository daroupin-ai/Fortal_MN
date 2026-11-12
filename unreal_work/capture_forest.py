import unreal as u
import time
from pathlib import Path
actors = u.get_editor_subsystem(u.EditorActorSubsystem)
camera = next(a for a in actors.get_all_level_actors() if a.get_actor_label() == 'Forest_View_Camera')
level = u.get_editor_subsystem(u.LevelEditorSubsystem)
level.pilot_level_actor(camera)
level.editor_set_game_view(True)
output='D:/이무늬_손짓으로 여는 AI 세계/unreal_work/forest_'+time.strftime('%H%M%S')+'.png'
u.AutomationLibrary.take_high_res_screenshot(1280,720,output,camera=camera,delay=2.0)
Path('D:/이무늬_손짓으로 여는 AI 세계/unreal_work/latest_preview.txt').write_text(output,encoding='utf-8')
