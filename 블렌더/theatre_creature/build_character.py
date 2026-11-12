"""Reference-inspired theatre creature, with separate hands and lower jaw.
Run with Blender in background. Existing hamster assets are never modified.
"""
import bpy
import math
import json
from array import array
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output' / 'red-paper-3d'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
objects = []
def xyz(p): return (p[0], -p[2], p[1])
def material(name, color, rough=.28):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough
    return m
ivory=material('Glazed warm ivory',(.88,.78,.61))
tooth=material('Ivory pointed teeth',(.96,.88,.71),.22)
pink=material('Dusty rose gums',(.47,.16,.15),.34)
red=material('Terracotta paper',(.51,.16,.083),.64)
purple=material('Slate blue paper',(.20,.30,.40),.64)
blush=material('Golden cheek paint',(.68,.43,.18))
gold=material('Pale gold eye ring',(.87,.65,.25))
blue=material('Pale blue eyes',(.34,.47,.57))
black=material('Obsidian pupils',(.004,.006,.009),.12)
dark=material('Deep mouth cavity',(.035,.008,.012),.65)
brown=material('Taupe eye ring',(.27,.19,.16))
rose=material('Pink eye ring',(.55,.28,.18))
white=material('Eye catchlights',(1,1,.95),.12)

def attach(o,name,mat,group='body'):
    o.name=name;o.data.materials.append(mat);o['web_group']=group;objects.append(o)
    for p in o.data.polygons:p.use_smooth=True
    return o
def ellipsoid(name,center,radius,mat,group='body',segments=40,rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=xyz(center))
    o=bpy.context.object;o.scale=(radius[0],radius[2],radius[1])
    return attach(o,name,mat,group)
def mesh(name,points,faces,mat,group='body'):
    data=bpy.data.meshes.new(name);data.from_pydata([xyz(p) for p in points],[],faces);data.update()
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o)
    return attach(o,name,mat,group)
def tube(name,points,radius,mat,group='body',sides=10):
    verts=[];faces=[]
    for i,p in enumerate(points):
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])
        tangent.normalize();axis=tangent.cross(Vector((0,0,1)))
        if axis.length<.01:axis=Vector((1,0,0))
        axis.normalize();other=tangent.cross(axis).normalized()
        for j in range(sides):
            q=Vector(p)+radius*(axis*math.cos(j*2*math.pi/sides)+other*math.sin(j*2*math.pi/sides))
            verts.append(tuple(q))
        if i:
            for j in range(sides):
                a=(i-1)*sides+j;b=(i-1)*sides+(j+1)%sides
                faces.append((a,b,b+sides,a+sides))
    return mesh(name,verts,faces,mat,group)

ellipsoid('Round ivory head',(0,1.37,0),(1.02,1.08,.43),ivory)
for i in range(28):
    a=2*math.pi*i/28
    o=ellipsoid('Scalloped porcelain rim', (1.02*math.cos(a),1.37+1.07*math.sin(a),-.02),(.16,.20,.17),ivory,segments=24,rings=16)
    o.rotation_euler[1]=-a+math.pi/2

# Sculpted leaf-like horns: thick central ridges, ruffled edges, narrow tips.
for sign,mat in [(-1,purple),(1,red)]:
    vertices=[];faces=[];rows=44;cols=12
    for side in [1,-1]:
        for i in range(rows+1):
            t=i/rows
            cx=sign*(.64+1.05*t);cy=2.02+1.30*math.sin(t*math.pi*.77)
            width=.32*(math.sin(math.pi*t)**.75)*(1-.45*t)+.008
            for j in range(cols+1):
                u=j/cols*2-1
                ripple=1+.14*math.sin(t*math.pi*22)*abs(u)**4
                x=cx+u*width*ripple
                y=cy-sign*u*width*.6
                z=.20+side*(.025+.085*(1-u*u))*math.sin(math.pi*t)+.025*math.sin(t*19+u*4)
                vertices.append((x,y,z))
    layer=(rows+1)*(cols+1)
    for layer_index in range(2):
        for i in range(rows):
            for j in range(cols):
                a=layer_index*layer+i*(cols+1)+j
                quad=(a,a+1,a+cols+2,a+cols+1)
                faces.append(quad if layer_index==0 else tuple(reversed(quad)))
    for i in range(rows):
        for j in [0,cols]:
            a=i*(cols+1)+j;b=(i+1)*(cols+1)+j;faces.append((a,b,b+layer,a+layer))
    horn=mesh('Pleated paper horn',vertices,faces,mat)
    horn.data.materials.append(red if sign<0 else purple)
    for face in horn.data.polygons:
        face.material_index=int((face.index//cols)%8>=4)
    tip=sign*1.69
    ellipsoid('Brass horn bell',(tip,2.78,.21),(.115,.12,.093),gold,segments=24,rings=16)
    ellipsoid('Bell seam',(tip,2.75,.23),(.122,.025,.093),brown,segments=24,rings=12)

# Concentric eyes project out from the face, each ring is a rounded solid disc.
for sign in [-1,1]:
    x=sign*.45
    for name,r,z,mat in [('Ivory socket',.335,.39,ivory),('Outer coloured rim',.300,.49,rose if sign<0 else red),('Taupe ring',.258,.56,brown),('Golden ring',.218,.62,gold),('Blue iris',.166,.69,blue),('Black pupil',.089,.76,black)]:
        ellipsoid(name,(x,1.65,z),(r,r*1.12,.085),mat,segments=40,rings=20)
    ellipsoid('Eye glint',(x-.025,1.688,.843),(.019,.022,.008),white,segments=20,rings=12)
    ellipsoid('Golden cheek',(sign*.79,1.28,.40),(.125,.072,.035),blush)
ellipsoid('Little gold nose',(0,1.34,.49),(.095,.15,.095),gold)
for i in range(5):
    a=i*2*math.pi/5+math.pi/2
    o=ellipsoid('Red flower petal',(.115*math.cos(a),1.17+.115*math.sin(a),.62),(.13,.042,.035),red,segments=28,rings=16)
    o.rotation_euler[1]=-a
ellipsoid('Flower centre',(0,1.17,.66),(.036,.036,.03),red)

def upper(x):return 1.12-.13*(1-(x/.88)**2)
def lower(x):return .43+.69*(x/.88)**2
# Curved, hollow-looking smile. Marker 2 stretches the cavity when the jaw opens.
verts=[];faces=[]
for i in range(65):
    x=-.88+1.76*i/64
    for j in range(9):
        t=j/8;verts.append((x,upper(x)*(1-t)+lower(x)*t,.49+.06*(1-(x/.88)**2)))
    if i:
        for j in range(8):a=(i-1)*9+j;faces.append((a,a+1,a+10,a+9))
mesh('Dark smile cavity',verts,faces,dark,'mouth')
xs=[-.88+1.76*i/64 for i in range(65)]
tube('Upper ivory smile edge',[(x,upper(x)+.065,.53) for x in xs],.065,ivory)
tube('Upper rose gum',[(x,upper(x),.58) for x in xs],.048,pink)
tube('Lower ivory smile edge',[(x,lower(x)-.055,.52) for x in xs],.073,ivory,'jaw')
tube('Lower rose gum',[(x,lower(x),.59) for x in xs],.055,pink,'jaw')

def fang(name,start,end,radius,group):
    start=Vector(start);end=Vector(end);vertices=[];faces=[];sides=12;rings=9
    for k in range(rings+1):
        t=k/rings;center=start.lerp(end,t);center.z+=.04*math.sin(t*math.pi)
        r=max(.0005,radius*(1-t)**.72)
        for j in range(sides):
            a=j*2*math.pi/sides;vertices.append((center.x+r*math.cos(a),center.y,center.z+r*.7*math.sin(a)))
        if k:
            for j in range(sides):
                a=(k-1)*sides+j;b=(k-1)*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
    mesh(name,vertices,faces,tooth,group)
for i in range(21):
    x=-.81+1.62*i/20;length=.19+.13*(1-abs(x)/.85)
    fang('Upper pointed tooth',(x,upper(x)-.015,.635),(x*.95,upper(x)-length,.665),.039,'body')
    fang('Lower pointed tooth',(x,lower(x)+.01,.635),(x*.95,lower(x)+length*.87,.665),.037,'jaw')

# The feet rest at local y = -1.62. Keep the neckline behind the moving jaw.
ellipsoid('Tailored bodice',(0,-.16,-.02),(.65,.51,.34),brown,segments=32,rings=20)
for i in range(16):
    a=math.tau*i/16
    b=math.tau*(i+1)/16
    mid=(a+b)/2
    def garment(angle,radius,y):
        return (radius*math.cos(angle),y,.53*radius*math.sin(angle)-.03)
    front_color=purple if i%2 else red
    for top_y,hem_y,inner,outer in [(.48,.17,.38,1.01),(.20,-.17,.45,.82),(-.13,-.85,.45,.91),(-.39,-1.01,.49,1.04)]:
        hem_left=garment(a,outer*.94,hem_y+.055)
        hem_right=garment(b,outer*.94,hem_y+.055)
        fold=garment(mid,outer,hem_y-.04)
        root_left=garment(a,inner,top_y)
        root_right=garment(b,inner,top_y)
        root_fold=garment(mid,inner+.035,top_y+.025)
        mesh('Folded paper costume', [root_left,root_fold,root_right,hem_right,fold,hem_left],
             [(0,1,4,5),(1,2,3,4)],front_color)
        tube('Brass hem',[hem_left,fold,hem_right],.012,gold,sides=6)
    if i%2==0:
        ellipsoid('Coat bell',garment(mid,1.04,-1.10),(.058,.067,.058),gold,segments=16,rings=10)
for y in [-.24,-.42,-.61]:
    ellipsoid('Brass bodice button',(0,y,.44),(.068,.068,.032),gold,segments=20,rings=12)
for side in [-1,1]:
    x=side*.36
    ellipsoid('Striped stocking',(x,-1.13,.005),(.165,.35,.15),purple if side<0 else red,segments=24,rings=16)
    for y in [-1.14,-1.27]:
        ellipsoid('Stocking band',(x,y,.01),(.167,.043,.154),gold,segments=20,rings=12)
    ellipsoid('Shoe ankle',(x,-1.40,.04),(.20,.19,.24),red,segments=24,rings=16)
    ellipsoid('Shoe sole',(x+side*.08,-1.555,.20),(.32,.065,.36),brown,segments=24,rings=16)
    ellipsoid('Curled shoe body',(x+side*.06,-1.49,.21),(.27,.11,.34),red,segments=24,rings=16)
# Reference hands: five long fingers, curved ivory claws and coloured frill cuffs.
def tapered_curve(name,points,radii,mat,group):
    vertices=[];faces=[];sides=12
    for i,p in enumerate(points):
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])
        tangent.normalize();axis=tangent.cross(Vector((0,0,1))).normalized();other=tangent.cross(axis).normalized()
        for j in range(sides):
            a=j*2*math.pi/sides
            vertices.append(tuple(Vector(p)+radii[i]*(axis*math.cos(a)+other*math.sin(a))))
        if i:
            for j in range(sides):
                a=(i-1)*sides+j;b=(i-1)*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
    return mesh(name,vertices,faces,mat,group)

for side in [-1,1]:
    toe=[(side*.43,-1.48,.35),(side*.59,-1.48,.52),
         (side*.72,-1.43,.60),(side*.77,-1.35,.63),(side*.76,-1.28,.64)]
    tapered_curve('Upturned shoe tip',toe,[.15,.12,.087,.052,.012],red,'body')
    ellipsoid('Brass shoe bell',toe[-1],(.055,.054,.055),gold,segments=16,rings=10)

for sign,group in [(-1,'leftPaw'),(1,'rightPaw')]:
    accent=purple if sign<0 else red
    def hp(x,y,z=.30):return (sign*(1.43+x),.53+y,z)
    ellipsoid('Terracotta palm',hp(0,.28),(.19,.25,.085),red,group,32,20)
    ellipsoid('Coloured wrist cuff',hp(0,-.025),(.18,.12,.10),accent,group,32,16)
    for i in range(9):
        a=i*2*math.pi/9
        ellipsoid('Porcelain scalloped wrist',hp(.15*math.cos(a),.045+.05*math.sin(a),.30+.07*math.sin(a)),(.065,.075,.055),ivory,group,20,12)
        x=.17*math.cos(a)
        tapered_curve('Curled cuff fringe',[hp(x,-.03,.30+.06*math.sin(a)),hp(x*1.2,-.14,.32+.06*math.sin(a)),hp(x*1.35,-.17,.35+.06*math.sin(a)),hp(x*1.45,-.13,.36+.06*math.sin(a))],[.055,.05,.03,.003],accent,group)
    # Outer little finger to inner index finger; thumb points towards the face.
    for i,(x,spread,height) in enumerate([(.13,.13,.80),(.045,.055,.99),(-.045,-.035,1.04),(-.13,-.12,.88)]):
        base=hp(x,.39);joint=hp(x+spread*.48,.60,.32);tip=hp(x+spread,height-.13,.32)
        tapered_curve('Long finger',[base,joint,tip],[.050,.046,.032],red,group)
        ellipsoid('Soft pink knuckle',joint,(.047,.055,.042),rose,group,20,12)
        ellipsoid('Coloured nail root',tip,(.038,.045,.035),accent,group,20,12)
        tapered_curve('Curved ivory claw',[tip,hp(x+spread*1.1,height-.055,.36),hp(x+spread*1.2+.035,height,.37)],[.033,.023,.001],tooth,group)
    tapered_curve('Long thumb',[hp(-.13,.20),hp(-.26,.32,.32),hp(-.33,.47,.33)],[.065,.055,.037],red,group)
    ellipsoid('Thumb nail root',hp(-.33,.47,.33),(.043,.047,.038),accent,group,20,12)
    tapered_curve('Thumb ivory claw',[hp(-.33,.47,.33),hp(-.37,.55,.36),hp(-.36,.62,.37)],[.035,.023,.001],tooth,group)
    ellipsoid('Gold hand marking',hp(.075,.25,.382),(.042,.065,.014),blush,group,24,16)

# Export the same compact interleaved mesh format as the existing stage renderer.
bpy.context.view_layer.update();depsgraph=bpy.context.evaluated_depsgraph_get()
groups={name:[] for name in ['body','leftPaw','rightPaw','jaw','mouth','miniature']}
def export_object(obj,group):
    evaluated=obj.evaluated_get(depsgraph);data=evaluated.to_mesh();data.calc_loop_triangles()
    palette=[tuple(v**(1/2.2) for v in mat.diffuse_color[:3]) for mat in obj.data.materials];matrix=obj.matrix_world
    normal=matrix.to_3x3().inverted().transposed()
    for tri in data.loop_triangles:
        rgb=palette[data.polygons[tri.polygon_index].material_index]
        for vi,li in zip(tri.vertices,tri.loops):
            p=matrix@data.vertices[vi].co;n=(normal@data.corner_normals[li].vector).normalized()
            position=(p.x,p.z,-p.y)
            if group=='miniature':
                if obj['web_group'] in ('leftPaw','rightPaw'):
                    # Smaller hands rest beside the coat on the stage puppets.
                    side=-1 if obj['web_group']=='leftPaw' else 1
                    position=(side*.91+(p.x-side*1.43)*.65,-.13-(p.z-.53)*.65,-p.y*.65)
                    n.z=-n.z
                position=(position[0]*.46,(position[1]+1.62)*.46,position[2]*.46)
            groups[group].extend([*position,n.x,n.z,-n.y,*rgb,2 if group=='mouth' else 0,0])
    evaluated.to_mesh_clear()
for obj in objects:
    export_object(obj,obj['web_group'])
    # Use the same costume and silhouette with fewer triangles for repeated actors.
    modifier=None
    if len(obj.data.polygons)>96:
        modifier=obj.modifiers.new('Miniature reduction','DECIMATE')
        modifier.ratio=max(.09,20/len(obj.data.polygons))
        bpy.context.view_layer.update()
    export_object(obj,'miniature')
    if modifier:
        obj.modifiers.remove(modifier)
bpy.context.view_layer.update()
packed=array('f');ranges={}
for name,values in groups.items():
    ranges[name]={'first':len(packed)//11,'count':len(values)//11};packed.extend(values)
(OUT/'theatre-character.bin').write_bytes(packed.tobytes())
(OUT/'theatre-character.json').write_text(json.dumps({'vertices':len(packed)//11,'stride':11,'groups':ranges,'source':'블렌더/theatre_creature/theatre_creature.blend','mouth':[0,.79,.67],'reference':'Terracotta and slate blue paper jester','jawTravel':.22},indent=2,ensure_ascii=False),encoding='utf8')

# Keep an editable Blender source and a neutral studio camera.
world=bpy.data.worlds.new('Studio world');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.18,.18,1)
for name,location,power,size in [('Key',(-3,-4,6),650,5),('Fill',(3,-2,4),400,4),('Rim',(0,3,5),600,3)]:
    light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='DISK';light.size=size
    o=bpy.data.objects.new(name,light);scene.collection.objects.link(o);o.location=location
    o.rotation_euler=(Vector((0,0,1.5))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-7,1.7));camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,.8))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=5.6;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(Path(__file__).parent/'character-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).parent/'theatre_creature.blend'))
print(json.dumps({'vertices':len(packed)//11,'objects':len(objects),'bytes':len(packed)*4}))
