"""Downtown avenue, batched architecture, street furniture and planted sidewalks."""

import math
import random

import bpy
from mathutils import Vector


def _material(name, color, roughness=.6, metallic=0, grain=0, emission=0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    if emission:
        shader.inputs['Emission Color'].default_value = (*color, 1)
        shader.inputs['Emission Strength'].default_value = emission
    if grain:
        texture = nodes.new('ShaderNodeTexNoise')
        texture.inputs['Scale'].default_value = 120 if 'Asphalt' in name else 36
        texture.inputs['Detail'].default_value = 3.5
        coordinates = nodes.new('ShaderNodeTexCoord')
        links.new(coordinates.outputs['Object'], texture.inputs['Vector'])
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .32
        bump.inputs['Distance'].default_value = grain
        links.new(texture.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], shader.inputs['Normal'])
        ramp = nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (*(channel*.72 for channel in color), 1)
        ramp.color_ramp.elements[1].color = (*(min(channel*1.2, 1) for channel in color), 1)
        links.new(texture.outputs['Fac'], ramp.inputs['Fac'])
        links.new(ramp.outputs['Color'], shader.inputs['Base Color'])
    return material


class _Batch:
    def __init__(self, collection):
        self.collection = collection
        self.geometry = {}

    def mesh(self, material, vertices, faces):
        vertices_out, faces_out = self.geometry.setdefault(material.name, ([], []))
        start = len(vertices_out)
        vertices_out.extend(vertices)
        faces_out.extend(tuple(start+index for index in face) for face in faces)

    def box(self, material, center, size):
        x, y, z = center
        dx, dy, dz = (component/2 for component in size)
        vertices = [(x-dx,y-dy,z-dz),(x+dx,y-dy,z-dz),(x+dx,y+dy,z-dz),(x-dx,y+dy,z-dz),
                    (x-dx,y-dy,z+dz),(x+dx,y-dy,z+dz),(x+dx,y+dy,z+dz),(x-dx,y+dy,z+dz)]
        faces = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
        self.mesh(material, vertices, faces)

    def cylinder(self, material, start, end, radius, segments=12, top_radius=None):
        a, b = Vector(start), Vector(end)
        axis = (b-a).normalized()
        side = axis.cross(Vector((0,0,1)))
        if side.length < .001:
            side = Vector((1,0,0))
        side.normalize()
        other = axis.cross(side).normalized()
        vertices = []
        for center, r in [(a, radius),(b, radius if top_radius is None else top_radius)]:
            for index in range(segments):
                angle = index*2*math.pi/segments
                vertices.append(tuple(center+r*(math.cos(angle)*side+math.sin(angle)*other)))
        faces = [(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)]
        faces.extend([tuple(reversed(range(segments))),tuple(range(segments,segments*2))])
        self.mesh(material, vertices, faces)

    def finish(self):
        objects = []
        for name, (vertices,faces) in self.geometry.items():
            mesh = bpy.data.meshes.new(name+' mesh')
            mesh.from_pydata(vertices, [], faces)
            mesh.update()
            obj = bpy.data.objects.new(name, mesh)
            self.collection.objects.link(obj)
            mesh.materials.append(bpy.data.materials[name])
            objects.append(obj)
        return objects


def build_city():
    rng = random.Random(83)
    collection = bpy.data.collections.new('City · Central Avenue')
    bpy.context.scene.collection.children.link(collection)
    batch = _Batch(collection)
    asphalt = _material('City · Asphalt aggregate',(.045,.052,.059),.83,grain=.018)
    sidewalk = _material('City · Pale concrete',(.37,.365,.33),.88,grain=.012)
    curb = _material('City · Granite kerbs',(.29,.29,.27),.85,grain=.008)
    joints = _material('City · Paving joints',(.115,.12,.12),.92)
    white = _material('City · Road paint',(.66,.66,.59),.68,grain=.003)
    yellow = _material('City · Amber road paint',(.78,.48,.085),.7)
    limestone = _material('City · Honed limestone',(.54,.45,.34),.75,grain=.006)
    pale_stone = _material('City · Cream stone',(.62,.59,.50),.8,grain=.006)
    stone_dark = _material('City · Dark stone',(.16,.18,.18),.73,grain=.006)
    terracotta = _material('City · Terracotta panels',(.30,.135,.075),.7,grain=.005)
    metal = _material('City · Blackened metal',(.035,.044,.048),.31,.72)
    aluminum = _material('City · Brushed aluminum',(.36,.40,.41),.32,.82)
    glass = _material('City · Blue solar glass',(.09,.18,.235),.19,.58)
    glass_dark = _material('City · Shadowed glass',(.025,.065,.09),.24,.47)
    glass_warm = _material('City · Warm interior glazing',(.36,.29,.18),.28,.32,emission=.12)
    glass_materials = [glass,glass,glass_dark,glass_dark,glass_warm]
    awning = _material('City · Deep teal canvas',(.035,.12,.12),.9,grain=.004)
    wood = _material('City · Oiled walnut',(.20,.085,.025),.64,grain=.008)
    soil = _material('City · Planter soil',(.055,.033,.015),.97,grain=.02)
    bark = _material('City · Tree bark',(.10,.067,.035),.9,grain=.028)
    foliage = [_material('City · Leaf '+str(i),color,.82) for i,color in enumerate([(.07,.13,.025),(.12,.20,.042),(.16,.25,.055),(.055,.105,.018)])]
    light = _material('City · Lamp diffuser',(.95,.78,.49),.4,emission=2)
    signal_green = _material('City · Green signal',(.05,.85,.35),.3,emission=4)
    signal_off = _material('City · Signal lens unlit',(.03,.009,.006),.28)

    batch.box(asphalt,(0,82.5,-.12),(18,275,.24))
    # Two cross streets open up the canyon and establish a believable route.
    for y in [18,100]:
        batch.box(asphalt,(0,y,-.125),(150,15,.24))
        for x in [-33,-24,24,33]:
            batch.box(white,(x,y+.10,.006),(5,.13,.012))
    sidewalk_ranges = [(-55,10.3),(25.7,92.3),(107.7,220)]
    for sign in [-1,1]:
        for start,end in sidewalk_ranges:
            length=end-start
            middle=(start+end)/2
            batch.box(sidewalk,(sign*11,middle,.075),(4,length,.15))
            batch.box(curb,(sign*9.07,middle,.11),(.20,length,.22))
            for y in range(math.ceil(start),math.floor(end),2):
                batch.box(joints,(sign*11,y,.153),(3.8,.014,.006))
            for x in [9.9,10.9,11.9]:
                batch.box(joints,(sign*x,middle,.153),(.014,length,.006))
        for y in range(-48,219,6):
            if any(abs(y-cross)<10 for cross in [18,100]):
                continue
            batch.box(white,(sign*4.5,y,.008),(.11,3,.016))
        for start,end in [(-55,9),(27,91),(109,220)]:
            batch.box(yellow,(sign*.105,(start+end)/2,.01),(.10,end-start,.018))
        if sign == 1:
            for y in [9.2,26.8,91.2,108.8]:
                for x in [-7.4,-5.9,-4.4,-2.9,-1.4,.1,1.6,3.1,4.6,6.1,7.6]:
                    batch.box(white,(x,y,.012),(.62,2.6,.024))
        for y in [-20,42,78,125,170,204]:
            x=sign*8.55
            batch.box(metal,(x,y,.017),(.56,1.0,.035))
            for offset in [-.20,-.10,0,.10,.20]:
                batch.box(aluminum,(x+offset,y,.039),(.035,.90,.012))

    def building(sign, y, width, depth, height, style):
        face=sign*13.05
        center=face+sign*depth/2
        wall=[limestone,pale_stone,terracotta,stone_dark][style%4]
        batch.box(wall,(center,y,height/2+.15),(depth,width,height))
        batch.box(stone_dark,(center,y,.45),(depth+.12,width+.16,.6))
        batch.box(wall,(center,y,height+.18),(depth+.36,width+.42,.36))
        batch.box(metal,(center,y,height+.50),(depth-.8,width-.8,.35))
        # Rooftop machinery reads as a real roof when the camera lifts.
        for dy in [-width*.23,width*.19]:
            batch.box(aluminum,(center,y+dy,height+.9),(2.1,2.3,.9))
            for slit in range(5):
                batch.box(metal,(center-sign*1.057,y+dy-.85+slit*.42,height+.9),(.025,.18,.50))
        columns=max(3,int(width/2.2))
        pitch=width/columns
        floors=max(2,int((height-4.5)/3.25))
        floor_height=(height-4.5)/floors
        for floor in range(floors):
            z=4.7+floor*floor_height+floor_height/2
            band_z=4.5+floor*floor_height
            batch.box(aluminum if style==3 else wall,(face-sign*.12,y,band_z),(.29,width+.10,.18))
            for column in range(columns):
                wy=y-width/2+(column+.5)*pitch
                panel_width=pitch-.25 if style==3 else pitch-.58
                panel_height=floor_height-.32 if style==3 else floor_height-.64
                batch.box(metal,(face-sign*.035,wy,z),(.12,panel_width+.14,panel_height+.14))
                batch.box(rng.choice(glass_materials),(face-sign*.105,wy,z),(.035,panel_width,panel_height))
                batch.box(aluminum,(face-sign*.14,wy,z),(.045,.032,panel_height))
                batch.box(aluminum,(face-sign*.14,wy,z+.10),(.045,panel_width,.035))
                if style in [0,2]:
                    batch.box(wall,(face-sign*.22,wy,z-panel_height/2-.09),(.42,panel_width+.26,.15))
        # Exposed building returns have windows too, preventing flat side walls.
        for end_sign in [-1,1]:
            end_y=y+end_sign*(width/2+.015)
            for floor in range(floors):
                z=4.7+floor*floor_height+floor_height/2
                for step in range(1,int(depth/2.5)):
                    wx=face+sign*step*2.5
                    batch.box(glass_dark,(wx,end_y,z),(1.7,.04,floor_height-.72))
                    batch.box(aluminum,(wx,end_y+end_sign*.028,z),(.035,.035,floor_height-.72))
        # Ground-floor recessed shop front with a metal plinth and canopy.
        batch.box(metal,(face-sign*.06,y,2.05),(.16,width-.65,3.3))
        for column in range(columns):
            wy=y-width/2+(column+.5)*pitch
            batch.box(glass_dark,(face-sign*.155,wy,1.98),(.035,pitch-.25,2.95))
            batch.box(aluminum,(face-sign*.19,wy-pitch/2+.12,1.98),(.06,.065,3.02))
            batch.box(wood,(face-sign*.19,wy,.60),(.06,pitch-.26,.20))
            batch.box(aluminum,(face-sign*.19,wy+pitch*.20,1.53),(.06,.033,.64))
        batch.box(wall,(face-sign*.19,y,3.79),(.5,width,.30))
        if style!=3:
            batch.box(awning,(face-sign*.76,y,3.60),(1.5,width-.5,.12))
            batch.box(awning,(face-sign*1.46,y,3.40),(.09,width-.5,.35))
        for offset in [-width/2+.2,width/2-.2]:
            batch.box(wall,(face-sign*.20,y+offset,2.02),(.42,.36,3.5))

    # Frontage spacing deliberately leaves the intersections open.
    sites=[(-44,15),(-27,16),(-9,17),(38,19),(60,20),(81,17),(121,19),(143,20),(164,18),(186,20),(208,18)]
    for sign in [-1,1]:
        for index,(y,width) in enumerate(sites):
            height=rng.choice([13,16,19,22,26,31,37])
            building(sign,y+(1.2 if sign<0 else 0),width,rng.uniform(12,20),height,(index+(sign==1))%4)
    # Background towers extend beyond the street facades.
    for sign in [-1,1]:
        for index in range(10):
            x=sign*rng.uniform(36,60)
            y=-36+index*26
            height=rng.uniform(25,60)
            batch.box(stone_dark,(x,y,height/2),(rng.uniform(12,18),16,height))
            for z in range(5,int(height),4):
                batch.box(glass,(x-sign*7.05,y,z),(.08,14,2.5))

    def tree(sign,y):
        x=sign*11.7
        batch.box(stone_dark,(x,y,.34),(1.65,2.0,.40))
        batch.box(soil,(x,y,.55),(1.4,1.74,.05))
        batch.cylinder(bark,(x,y,.55),(x+.06,y,3.8),.11,12,.045)
        centers=[(x,y,4.1),(x-.55,y-.1,3.75),(x+.52,y+.25,3.9),(x+.10,y-.55,4.4)]
        for cx,cy,cz in centers:
            batch.cylinder(bark,(x,y,2.5),(cx,cy,cz),.045,8,.012)
        for _ in range(680):
            cx,cy,cz=rng.choice(centers)
            angle=rng.uniform(0,2*math.pi)
            radius=rng.random()**(1/3)
            phi=math.acos(rng.uniform(-1,1))
            p=Vector((cx+radius*.85*math.sin(phi)*math.cos(angle),cy+radius*.85*math.sin(phi)*math.sin(angle),cz+radius*.80*math.cos(phi)))
            direction=Vector((rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(-.4,.7))).normalized()
            side=direction.cross(Vector((0,0,1))).normalized()
            length=rng.uniform(.14,.24)
            width=length*.45
            points=[tuple(p-direction*length),tuple(p-side*width),tuple(p+Vector((0,0,.025))),tuple(p+side*width),tuple(p+direction*length)]
            batch.mesh(rng.choice(foliage),points,[(0,1,2),(1,4,2),(4,3,2),(3,0,2)])

    for sign in [-1,1]:
        for y in [-35,-15,39,61,81,122,144,166,188,209]:
            tree(sign,y)
        for y in [-42,-21,1,36,57,78,116,137,158,179,200]:
            x=sign*9.7
            batch.cylinder(metal,(x,y,.15),(x,y,6.5),.075,12,.045)
            batch.cylinder(metal,(x,y,6.43),(x-sign*1.4,y,6.63),.055,10)
            batch.box(metal,(x-sign*1.55,y,6.6),(.62,.32,.13))
            batch.box(light,(x-sign*1.55,y,6.525),(.52,.25,.025))
            batch.cylinder(metal,(x,y,.15),(x,y,.65),.14,12)
        for y in [-18,45,72,130,176,202]:
            for offset in [-.45,0,.45]:
                batch.box(wood,(sign*11.4,y+offset,.61),(.58,.13,.10))
            for offset in [-.4,.4]:
                batch.box(metal,(sign*11.4,y+offset,.37),(.45,.07,.45))
            batch.box(metal,(sign*12.15,y+1.7,.53),(.46,.46,.75))
            batch.box(aluminum,(sign*12.15,y+1.7,.93),(.49,.49,.04))
        for cross_y in [18,100]:
            for side_y in [-1,1]:
                y=cross_y+side_y*8.4
                for offset in [0,1.2,2.4]:
                    batch.cylinder(metal,(sign*(9.6+offset),y,.15),(sign*(9.6+offset),y,.94),.055,10)
                x=sign*9.65
                batch.cylinder(metal,(x,y,.15),(x,y,5.5),.085,12)
                batch.cylinder(metal,(x,y,5.4),(sign*5.9,y,5.4),.065,12)
                batch.box(metal,(sign*6.2,y,5.16),(.40,.34,1.10))
                for index in range(3):
                    mat=signal_green if index==0 else signal_off
                    batch.cylinder(mat,(sign*6.2,y-.18,4.82+index*.32),(sign*6.2,y-.205,4.82+index*.32),.12,16)
    batch.finish()
    collection['description']='275m downtown avenue, two cross streets, detailed mixed facades, PBR asphalt and stone, storefronts and planted sidewalks.'
    return collection
