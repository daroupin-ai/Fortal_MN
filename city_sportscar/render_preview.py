import bpy
import os
import sys

OUT = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT, 'city_sportscar_15s.blend'))
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.eevee.taa_render_samples = 32
scene.eevee.use_raytracing = True
scene.eevee.use_fast_gi = True
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.use_motion_blur = True
scene.render.motion_blur_shutter = .28

if '--still' in sys.argv:
    scene.frame_set(168)
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = os.path.join(OUT, 'preview_video_quality.png')
    bpy.ops.render.render(write_still=True)
else:
    scene.render.image_settings.media_type = 'VIDEO'
    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'
    scene.render.ffmpeg.codec = 'H264'
    scene.render.ffmpeg.constant_rate_factor = 'MEDIUM'
    scene.render.ffmpeg.ffmpeg_preset = 'GOOD'
    scene.render.filepath = os.path.join(OUT, 'city_sportscar_15s_preview.mp4')
    scene.frame_set(1)
    bpy.ops.render.render(animation=True)
