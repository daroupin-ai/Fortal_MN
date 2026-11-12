"""Brandless performance coupe. Front is +Y, wheel spin axis is local X."""

import math
import bpy
import bmesh
from mathutils import Vector


def _material(name, color, metallic=0, roughness=.35, coat=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Coat Weight'].default_value = coat
    bsdf.inputs['Coat Roughness'].default_value = .14
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    return mat


def build_car():
    collection = bpy.data.collections.new('Sports coupe · components')
    bpy.context.scene.collection.children.link(collection)
    root = bpy.data.objects.new('SportsCar_Rig', None)
    collection.objects.link(root)
    root.empty_display_size = .5
    root['front_axis'] = '+Y'
    root['wheel_radius'] = .36

    paint = _material('PBR · metallic deep ocean blue',(.018,.19,.27),.70,.28,.7)
    black = _material('PBR · satin carbon trim',(.013,.016,.019),.32,.32)
    glass = _material('PBR · smoked automotive glass',(.009,.019,.026),.55,.12,.8)
    rubber = _material('PBR · tire rubber',(.014,.016,.018),0,.82)
    alloy = _material('PBR · diamond cut aluminum',(.53,.60,.65),.94,.22)
    dark_alloy = _material('PBR · gunmetal wheels',(.055,.067,.076),.88,.27)
    brake = _material('PBR · steel brake rotors',(.28,.29,.30),.92,.35)
    red = _material('PBR · red brake calipers',(.55,.025,.009),.4,.25,.6)
    headlight = _material('White LED signature',(.72,.86,1),.1,.18,0,6)
    tail = _material('Red LED signature',(.65,.005,.009),.2,.19,0,4)
    amber = _material('Amber marker',(.8,.19,.015),.1,.2,0,2)
    noise = rubber.node_tree.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 95
    bump = rubber.node_tree.nodes.new('ShaderNodeBump')
    bump.inputs['Distance'].default_value = .009
    bump.inputs['Strength'].default_value = .25
    rubber.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    rubber.node_tree.links.new(bump.outputs['Normal'],rubber.node_tree.nodes.get('Principled BSDF').inputs['Normal'])

    def link(obj, mat, parent=root):
        for col in list(obj.users_collection):
            col.objects.unlink(obj)
        collection.objects.link(obj)
        obj.parent = parent
        if mat:
            obj.data.materials.append(mat)
        return obj

    def mesh(name, vertices, faces, mat, parent=root, smooth=True):
        data = bpy.data.meshes.new(name)
        data.from_pydata(vertices, [], faces)
        data.update()
        topology = bmesh.new()
        topology.from_mesh(data)
        bmesh.ops.recalc_face_normals(topology, faces=list(topology.faces))
        topology.to_mesh(data)
        topology.free()
        obj = bpy.data.objects.new(name, data)
        collection.objects.link(obj)
        obj.parent = parent
        data.materials.append(mat)
        for poly in data.polygons:
            poly.use_smooth = smooth
        return obj

    def box(name, location, dimensions, mat, bevel=.025, parent=root):
        bpy.ops.mesh.primitive_cube_add(size=1, location=location)
        obj = bpy.context.object
        obj.name = name
        obj.dimensions = dimensions
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        link(obj, mat, parent)
        if bevel:
            modifier = obj.modifiers.new('Soft manufactured edges','BEVEL')
            modifier.width = bevel
            modifier.segments = 3
            normal = obj.modifiers.new('Panel normals','WEIGHTED_NORMAL')
            normal.keep_sharp = True
        return obj

    def line(name, coordinates, radius, mat, parent=root):
        data = bpy.data.curves.new(name,'CURVE')
        data.dimensions = '3D'
        data.resolution_u = 12
        data.bevel_depth = radius
        data.bevel_resolution = 3
        spline = data.splines.new('BEZIER')
        spline.bezier_points.add(len(coordinates)-1)
        for point,co in zip(spline.bezier_points,coordinates):
            point.co = co
            point.handle_left_type = 'AUTO'
            point.handle_right_type = 'AUTO'
        obj=bpy.data.objects.new(name,data)
        collection.objects.link(obj)
        obj.parent=parent
        data.materials.append(mat)
        return obj

    # The front/rear deck, shoulders and underbody are one continuous shell.
    stations=[
        (-2.30,.69,.56),(-2.22,.88,.72),(-2.04,.97,.83),
        (-1.70,1.00,.88),(-1.37,1.00,.90),(-1.00,.94,.85),
        (-.55,.91,.79),(0,.91,.78),(.55,.94,.77),
        (1.0,.98,.78),(1.37,1.00,.85),(1.70,.98,.82),
        (2.04,.91,.70),(2.25,.79,.58),(2.32,.64,.49),
    ]
    vertices=[]
    cross_sections=20
    for y,width,top in stations:
        for j in range(cross_sections):
            angle=2*math.pi*j/cross_sections
            x=width*math.copysign(abs(math.cos(angle))**.55,math.cos(angle))
            sin=math.sin(angle)
            z=.47+(top-.47)*sin if sin>=0 else .47+.20*sin
            vertices.append((x,y,z))
    faces=[]
    for row in range(len(stations)-1):
        for j in range(cross_sections):
            faces.append((row*cross_sections+j,row*cross_sections+(j+1)%cross_sections,(row+1)*cross_sections+(j+1)%cross_sections,(row+1)*cross_sections+j))
    faces.extend([tuple(reversed(range(cross_sections))),tuple(range((len(stations)-1)*cross_sections,len(stations)*cross_sections))])
    body=mesh('Sculpted coupe body',vertices,faces,paint)
    bpy.context.view_layer.objects.active=body
    body.select_set(True)
    subdivision=body.modifiers.new('Coachwork surfacing','SUBSURF')
    subdivision.levels=2
    bpy.ops.object.modifier_apply(modifier=subdivision.name)
    # Real wheel openings cut through the body, one axle at a time.
    for y in [-1.37,1.37]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=.425,depth=3,location=(0,y,.38),rotation=(0,math.pi/2,0))
        cutter=bpy.context.object
        boolean=body.modifiers.new('Open wheel arches','BOOLEAN')
        boolean.operation='DIFFERENCE'
        boolean.object=cutter
        bpy.context.view_layer.objects.active=body
        bpy.ops.object.modifier_apply(modifier=boolean.name)
        bpy.data.objects.remove(cutter,do_unlink=True)
    bevel=body.modifiers.new('Wheel arch edge softness','BEVEL')
    bevel.width=.012
    bevel.segments=2

    # A low continuous glass canopy, covered by painted roof and narrow pillars.
    canopy_stations=[(-1.30,.73,.83),(-.93,.74,1.12),(-.50,.74,1.31),(.12,.73,1.33),(.42,.73,1.25),(1.02,.71,.80)]
    verts=[]
    for y,width,z in canopy_stations:
        for j in range(17):
            t=-1+2*j/16
            verts.append((width*t,y,.79+(z-.79)*max(0,1-abs(t)**6)**.4))
    fs=[]
    for i in range(len(canopy_stations)-1):
        for j in range(16):
            fs.append((i*17+j,i*17+j+1,(i+1)*17+j+1,(i+1)*17+j))
    canopy=mesh('Continuous smoked glass canopy',verts,fs,glass)
    sub=canopy.modifiers.new('Curved glazing','SUBSURF')
    sub.levels=2
    roof=box('Painted roof crown',(0,-.24,1.312),(.99,.84,.07),paint,.065)
    for sign in [-1,1]:
        line('A pillar',[(sign*.70,1.01,.80),(sign*.63,.51,1.09),(sign*.49,.12,1.31)],.021,paint)
        line('Rear roof buttress',[(sign*.49,-.64,1.29),(sign*.67,-1.03,.99),(sign*.78,-1.43,.86)],.035,paint)
        line('Window lower seal',[(sign*.71,1.00,.80),(sign*.72,0,.82),(sign*.72,-.9,.86)],.015,black)
        line('Door shut line',[(sign*.934,.78,.67),(sign*.936,.66,.45),(sign*.93,-.72,.44),(sign*.94,-.9,.76)],.0045,black)
        box('Flush door handle',(sign*.933,-.40,.72),(.018,.20,.033),dark_alloy,.012)
        line('Mirror stalk',[(sign*.69,.68,.91),(sign*.89,.62,.95)],.025,black)
        mirror=box('Aerodynamic mirror',(sign*.98,.60,.98),(.22,.25,.10),paint,.048)
        box('Mirror glass',(sign*.98,.48,.984),(.16,.012,.065),alloy,.02)
        line('Side sill',[(sign*.95,-1.02,.31),(sign*.97,0,.28),(sign*.98,1.04,.30)],.038,black)
        # Dark inset makes a deep rear quarter intake and adds a body crease.
        intake=mesh('Side intake',[(sign*.947,-.78,.56),(sign*.963,-1.04,.76),(sign*.982,-1.18,.71),(sign*.956,-1.01,.48)],[(0,1,2,3)],black,smooth=False)
        line('Intake blade',[(sign*.964,-1.03,.49),(sign*.984,-1.14,.69)],.018,paint)
        line('Hood shoulder crease',[(sign*.55,2.04,.71),(sign*.62,1.63,.82),(sign*.60,1.04,.83)],.008,paint)

    # Front fascia and recessed grille.
    box('Front grille mouth',(0,2.342,.40),(1.20,.045,.19),black,.07)
    for x in [-.46,-.23,0,.23,.46]:
        box('Grille vane',(x,2.371,.40),(.025,.014,.13),dark_alloy,.005)
    line('Front carbon splitter',[(-.86,2.15,.27),(-.60,2.31,.25),(0,2.37,.25),(.60,2.31,.25),(.86,2.15,.27)],.033,black)
    for sign in [-1,1]:
        housing=box('Front lamp recess',(sign*.60,2.142,.625),(.42,.09,.040),black,.019)
        housing.rotation_euler[2]=sign*-.12
        line('LED daytime light',[(sign*.39,2.191,.638),(sign*.60,2.189,.646),(sign*.79,2.147,.650)],.009,headlight)
        line('LED lower accent',[(sign*.44,2.191,.617),(sign*.64,2.187,.622),(sign*.76,2.150,.628)],.004,headlight)
        box('Front corner vent',(sign*.76,2.11,.40),(.18,.10,.15),black,.045)
        box('Side marker',(sign*.986,1.77,.58),(.013,.11,.025),amber,.008)
    # Rear lighting, diffuser, exhaust and a subtle integrated ducktail.
    line('Rear red LED bar',[(-.79,-2.19,.69),(-.42,-2.265,.72),(0,-2.28,.725),(.42,-2.265,.72),(.79,-2.19,.69)],.018,tail)
    box('Rear lower diffuser',(0,-2.22,.34),(1.46,.18,.15),black,.04)
    for x in [-.52,-.26,0,.26,.52]:
        box('Diffuser fin',(x,-2.24,.28),(.022,.34,.12),black,.007)
    line('Rear ducktail',[(-.88,-2.03,.84),(-.5,-2.15,.87),(0,-2.18,.87),(.5,-2.15,.87),(.88,-2.03,.84)],.035,paint)
    for sign in [-1,1]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.065,depth=.15,location=(sign*.68,-2.27,.35),rotation=(math.pi/2,0,0))
        pipe=link(bpy.context.object,alloy)
        pipe.name='Exhaust tip'
        bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.048,depth=.152,location=(sign*.68,-2.278,.35),rotation=(math.pi/2,0,0))
        link(bpy.context.object,black).name='Exhaust opening'

    wheels=[]
    for sign in [-1,1]:
        for y in [-1.37,1.37]:
            wheel=bpy.data.objects.new(('Left' if sign<0 else 'Right')+(' front wheel' if y>0 else ' rear wheel'),None)
            collection.objects.link(wheel)
            wheel.parent=root
            wheel.location=(sign*.965,y,.38)
            wheel.empty_display_size=.12
            wheel['spin_axis']='X'
            wheels.append(wheel)
            # Revolved tire with rounded shoulders and actual sidewalls.
            profile=[(-.145,.255),(-.145,.305),(-.127,.342),(-.090,.36),(.09,.36),(.127,.342),(.145,.305),(.145,.255)]
            vs=[]
            fs=[]
            for x,radius in profile:
                for j in range(96):
                    a=2*math.pi*j/96
                    vs.append((x,radius*math.sin(a),radius*math.cos(a)))
            for k in range(len(profile)-1):
                for j in range(96):
                    fs.append((k*96+j,k*96+(j+1)%96,(k+1)*96+(j+1)%96,(k+1)*96+j))
            mesh('Performance tire',vs,fs,rubber,wheel)
            def wheel_cylinder(name,x,radius,depth,mat):
                bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=radius,depth=depth,location=(x,0,0),rotation=(0,math.pi/2,0))
                obj=bpy.context.object
                obj.name=name
                link(obj,mat,wheel)
                for poly in obj.data.polygons:
                    poly.use_smooth=True
                return obj
            wheel_cylinder('Wheel barrel',0,.26,.23,dark_alloy)
            wheel_cylinder('Ventilated brake disc',sign*.11,.224,.018,brake)
            wheel_cylinder('Hub',sign*.161,.067,.028,alloy)
            wheel_cylinder('Center cap',sign*.179,.039,.006,dark_alloy)
            for j in range(5):
                a=2*math.pi*j/5
                # Swept forged spokes, each a beveled solid blade.
                points=[]
                for xx in [sign*.145,sign*.172]:
                    for radius,angle in [(.057,a-.19),(.25,a+.09),(.25,a+.30),(.065,a+.23)]:
                        points.append((xx,radius*math.sin(angle),radius*math.cos(angle)))
                spoke=mesh('Forged swept spoke',points,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],alloy,wheel)
                bevel=spoke.modifiers.new('Machined bevel','BEVEL')
                bevel.width=.008
                bevel.segments=2
                lug=wheel_cylinder('Wheel bolt',sign*.183,.008,.006,alloy)
                lug.location.y=.052*math.sin(a)
                lug.location.z=.052*math.cos(a)
            for radius in [.252,.271]:
                bpy.ops.mesh.primitive_torus_add(major_segments=96,minor_segments=10,location=(sign*.145,0,0),rotation=(0,math.pi/2,0),major_radius=radius,minor_radius=.009)
                link(bpy.context.object,alloy,wheel).name='Polished wheel lip'
            # Caliper stays fixed to the chassis while the wheel spins.
            box('Fixed red brake caliper',(sign*1.09,y-.17,.44),(.065,.085,.17),red,.025)
            for j in range(18):
                a=2*math.pi*j/18
                mark=wheel_cylinder('Rotor drilled hole',sign*.122,.008,.002,black)
                mark.location.y=.184*math.sin(a)
                mark.location.z=.184*math.cos(a)
            for offset in [-.064,0,.064]:
                coords=[]
                for j in range(49):
                    a=2*math.pi*j/48
                    coords.append((offset,.3605*math.sin(a),.3605*math.cos(a)))
                line('Tread circumferential groove',coords,.0025,black,wheel)

    root['description']='Original ocean-blue sports coupe with metallic clearcoat, open wheel wells, separate animated wheels and PBR materials.'
    return root,wheels
