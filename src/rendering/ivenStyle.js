// Procedural scholar clothing/accessories over the existing animated villager.
// No extra character download or lights; sleeves, hair and book follow the rig.
export function createIvenStyle({ model, group, root }) {
  const h = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
  const cloth = new THREE.MeshStandardMaterial({ color:0xe8e6d9, roughness:.94, side:THREE.DoubleSide });
  const trim = new THREE.MeshBasicMaterial({ color:0x293c37, toneMapped:false });
  const hair = new THREE.MeshStandardMaterial({ color:0xe4e5df, roughness:1 });
  const skin = new THREE.MeshStandardMaterial({ color:0xd7b89c, roughness:.85 });
  const glass = new THREE.MeshBasicMaterial({ color:0x171e21 });
  function mesh(geometry, material, parent, x=0,y=0,z=0) {
    const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;
  }
  const profile=[[.18,.035],[.155,.22],[.125,.48],[.12,.67],[.14,.77],[.11,.82],[.065,.86]];
  const start=.52, sweep=Math.PI*2-start*2;
  mesh(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r*h,y*h)),24,start,sweep),cloth,group);
  for(const angle of [start,Math.PI*2-start]){
    const curve=new THREE.CatmullRomCurve3(profile.map(([r,y])=>new THREE.Vector3(Math.sin(angle)*r*h,y*h,Math.cos(angle)*r*h)));
    mesh(new THREE.TubeGeometry(curve,18,.007*h,5,false),trim,group);
  }
  const collar=mesh(new THREE.TorusGeometry(.067*h,.014*h,6,20),cloth,group,0,.84*h,0);collar.rotation.x=Math.PI/2;
  for(const y of [.74,.69,.64])mesh(new THREE.SphereGeometry(.008*h,6,5),trim,group,.065*h,y*h,.115*h);

  const head=new THREE.Group();root.add(head);
  mesh(new THREE.SphereGeometry(.073*h,12,10),skin,head,0,.065*h,0).scale.set(1,1.22,.94);
  mesh(new THREE.SphereGeometry(.081*h,14,8,0,Math.PI*2,0,Math.PI*.58),hair,head,0,.098*h,0);
  const lockGeo=new THREE.ConeGeometry(.024*h,.074*h,4);
  const locks=new THREE.InstancedMesh(lockGeo,hair,12),pose=new THREE.Object3D();
  for(let i=0;i<12;i++){
    const a=i*Math.PI*2/12;
    pose.position.set(Math.sin(a)*.064*h,.121*h,Math.cos(a)*.061*h);
    pose.rotation.set(0,a,Math.PI);pose.updateMatrix();locks.setMatrixAt(i,pose.matrix);
  }
  locks.instanceMatrix.needsUpdate=true;locks.castShadow=true;head.add(locks);
  for(const side of [-1,1]){
    mesh(new THREE.CircleGeometry(.026*h,16),glass,head,side*.034*h,.072*h,.075*h);
    mesh(new THREE.TorusGeometry(.029*h,.005*h,6,20),trim,head,side*.034*h,.072*h,.078*h);
    mesh(new THREE.BoxGeometry(.006*h,.006*h,.065*h),trim,head,side*.066*h,.072*h,.043*h);
  }
  mesh(new THREE.BoxGeometry(.021*h,.005*h,.008*h),trim,head,0,.072*h,.08*h);
  // A little nose and mouth keep the face readable below the dark round lenses.
  mesh(new THREE.SphereGeometry(.012*h,6,5),skin,head,0,.05*h,.072*h);
  mesh(new THREE.BoxGeometry(.025*h,.003*h,.003*h),trim,head,0,.025*h,.066*h);

  const book=new THREE.Group();root.add(book);
  mesh(new THREE.BoxGeometry(.16*h,.215*h,.045*h),trim,book);
  mesh(new THREE.BoxGeometry(.143*h,.195*h,.048*h),new THREE.MeshStandardMaterial({color:0xd7c99d,roughness:1}),book,.004*h,0,0);
  for(const side of [-1,1])mesh(new THREE.BoxGeometry(.164*h,.22*h,.007*h),trim,book,0,0,side*.027*h);
  mesh(new THREE.BoxGeometry(.014*h,.23*h,.003*h),cloth,book,.046*h,-.012*h,-.032*h);

  const sleeves=[];
  for(const side of ['l','r'])for(const [a,b,top,bottom] of [
    [`upperarm_${side}`,`lowerarm_${side}`, .063,.067],
    [`lowerarm_${side}`,`hand_${side}`, .06,.083],
  ]){
    const from=model.getObjectByName(a),to=model.getObjectByName(b);
    if(from&&to)sleeves.push({from,to,mesh:mesh(new THREE.CylinderGeometry(top*h,bottom*h,1,10),cloth,root)});
  }
  const headBone=model.getObjectByName('Head'),hand=model.getObjectByName('hand_l');
  const a=new THREE.Vector3(),b=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  return {
    update(){
      group.updateMatrixWorld(true);
      if(headBone)headBone.getWorldPosition(head.position);
      else {head.position.copy(group.position);head.position.y+=.85*h;}
      head.rotation.y=group.rotation.y;
      if(hand)hand.getWorldPosition(book.position);
      else {book.position.copy(group.position);book.position.y+=.5*h;}
      book.position.y-=.055*h;book.rotation.y=group.rotation.y+.15;
      for(const sleeve of sleeves){
        sleeve.from.getWorldPosition(a);sleeve.to.getWorldPosition(b);
        direction.subVectors(b,a);const length=direction.length();
        sleeve.mesh.position.copy(a).add(b).multiplyScalar(.5);
        sleeve.mesh.quaternion.setFromUnitVectors(up,direction.normalize());
        sleeve.mesh.scale.y=length+.025*h;
      }
    },
  };
}
