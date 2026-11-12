"""Import the three downloaded, free Quixel scans into a separate content folder."""
from pathlib import Path
import json
import unreal as u

WORK = Path('D:/이무늬_손짓으로 여는 AI 세계/unreal_work')
ROOT = '/Game/SmallForest/Megascans'
assets = u.get_editor_subsystem(u.EditorAssetSubsystem)
tools = u.AssetToolsHelpers.get_asset_tools()
assert u.get_editor_subsystem(u.LevelEditorSubsystem).save_current_level()
report = {}
saved = []
for name, folder in [('Terrain', 'forest_terrain_tletcalfa_high'),
                     ('Rock', 'nordic_forest_cluster_rock_small_xjijdiz_high'),
                     ('Fern', 'fern_sbsly_high')]:
    source = WORK / 'sources' / folder
    destination = ROOT + '/' + name
    textures = {}
    for channel in ['BaseColor', 'Normal', 'Roughness', 'AO', 'Opacity', 'Translucency']:
        files = [p for p in source.glob('*_' + channel + '.jpg') if 'Billboard' not in p.name]
        if not files:
            continue
        task = u.AssetImportTask()
        task.filename = str(files[0])
        task.destination_path = destination
        task.automated = True
        task.save = False
        task.replace_existing = True
        tools.import_asset_tasks([task])
        tex = next((x for x in task.get_objects() if isinstance(x, u.Texture2D)), None)
        assert tex, str(files[0])
        if channel != 'BaseColor' and channel != 'Translucency':
            tex.set_editor_property('srgb', False)
        if channel == 'Normal':
            tex.set_editor_property('compression_settings', u.TextureCompressionSettings.TC_NORMALMAP)
        textures[channel] = tex
        saved.append(tex)
    matpath = destination + '/M_' + name
    mat = u.load_asset(matpath) if assets.does_asset_exist(matpath) else tools.create_asset('M_' + name, destination, u.Material, u.MaterialFactoryNew())
    u.MaterialEditingLibrary.delete_all_material_expressions(mat)
    if name == 'Fern':
        mat.set_editor_property('blend_mode', u.BlendMode.BLEND_MASKED)
        mat.set_editor_property('two_sided', True)
        mat.set_editor_property('shading_model', u.MaterialShadingModel.MSM_TWO_SIDED_FOLIAGE)
    channels = {'BaseColor':u.MaterialProperty.MP_BASE_COLOR,
                'Normal':u.MaterialProperty.MP_NORMAL,
                'Roughness':u.MaterialProperty.MP_ROUGHNESS,
                'AO':u.MaterialProperty.MP_AMBIENT_OCCLUSION,
                'Opacity':u.MaterialProperty.MP_OPACITY_MASK,
                'Translucency':u.MaterialProperty.MP_SUBSURFACE_COLOR}
    for i, (channel, tex) in enumerate(textures.items()):
        node = u.MaterialEditingLibrary.create_material_expression(mat, u.MaterialExpressionTextureSample, -400, i*180)
        node.set_editor_property('texture', tex)
        if channel == 'Normal':
            node.set_editor_property('sampler_type', u.MaterialSamplerType.SAMPLERTYPE_NORMAL)
        elif channel not in ('BaseColor', 'Translucency'):
            node.set_editor_property('sampler_type', u.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR)
        u.MaterialEditingLibrary.connect_material_property(node, 'RGB' if channel in ('BaseColor','Normal','Translucency') else 'R', channels[channel])
    u.MaterialEditingLibrary.recompile_material(mat)
    saved.append(mat)
    meshes = []
    meshfiles = sorted(source.glob('*LOD0.fbx')) if name == 'Fern' else sorted(source.glob('*.fbx'))
    for file in meshfiles:
        task = u.AssetImportTask()
        task.filename = str(file)
        task.destination_path = destination
        task.automated = True
        task.save = False
        task.replace_existing = True
        options = u.FbxImportUI()
        options.set_editor_property('import_mesh', True)
        options.set_editor_property('import_as_skeletal', False)
        options.set_editor_property('import_materials', False)
        options.set_editor_property('import_textures', False)
        options.set_editor_property('mesh_type_to_import', u.FBXImportType.FBXIT_STATIC_MESH)
        options.static_mesh_import_data.set_editor_property('combine_meshes', True)
        options.static_mesh_import_data.set_editor_property('auto_generate_collision', False)
        task.options = options
        tools.import_asset_tasks([task])
        for mesh in task.get_objects():
            if isinstance(mesh, u.StaticMesh):
                for slot in range(max(1,len(mesh.get_editor_property('static_materials')))):
                    mesh.set_material(slot, mat)
                saved.append(mesh)
                bounds = mesh.get_bounds()
                meshes.append({'path':mesh.get_path_name(), 'extent':[bounds.box_extent.x,bounds.box_extent.y,bounds.box_extent.z]})
    assert meshes, name
    report[name] = {'meshes':meshes, 'material':mat.get_path_name()}
assert assets.save_loaded_assets(saved)
(WORK/'megascans_import_result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
u.log('MEGASCANS_IMPORT_COMPLETE ' + json.dumps(report))
