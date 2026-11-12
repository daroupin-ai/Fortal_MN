"""Small visual corrections and a camera preview of the created forest."""
from pathlib import Path
import unreal as u

actors = u.get_editor_subsystem(u.EditorActorSubsystem)
level = u.get_editor_subsystem(u.LevelEditorSubsystem)
camera = None
for actor in actors.get_all_level_actors():
    label = actor.get_actor_label()
    if label.startswith('Footpath_'):
        pos = actor.get_actor_location()
        pos.z = 0.5
        actor.set_actor_location(pos, False, False)
        size = actor.get_actor_scale3d()
        size.z = 0.025
        actor.set_actor_scale3d(size)
    elif label == 'Warm morning sunlight':
        actor.set_actor_rotation(u.Rotator(-35, -35, 0), False)
        actor.light_component.set_editor_property('intensity', 6.0)
        actor.light_component.set_editor_property('light_source_angle', 5.0)
    elif label == 'Soft sky fill':
        actor.light_component.set_editor_property('intensity', 1.3)
    elif label == 'Forest exposure':
        settings = actor.get_editor_property('settings')
        settings.set_editor_property('auto_exposure_bias', 0.5)
        actor.set_editor_property('settings', settings)
    elif label == 'Forest_View_Camera':
        camera = actor
assert camera
level.pilot_level_actor(camera)
level.editor_set_game_view(True)
assert level.save_current_level()
u.AutomationLibrary.take_high_res_screenshot(1280, 720, str(Path(__file__).with_name('forest_preview.png')), camera=camera, delay=3.0)
u.log('SMALL_FOREST_FINISHED')
