/** Synthetic in-memory contract cases, independently checked against backend PhoneNumbers 9.0.39. */
const {randomInt}=require('node:crypto');
module.exports=()=>{
 const cn='138'+String(randomInt(10000000,99999999)),jp='90'+String(randomInt(10000000,99999999));
 const sg='812'+String(randomInt(10000,99999)),us='20255501'+String(randomInt(10,99));
 const gb='7400'+String(randomInt(100000,999999));
 const cases=[];
 const add=(id,country,phone,want=null)=>cases.push({id,country,phone,want});
 for(const [id,country,phone] of [['cn','+86',cn],['jp','+81',jp],['sg','+65',sg],['us','+1',us],['gb','+44',gb]]){
  add(id+'-mobile',country,phone,phone);
  add(id+'-international',country,country+' '+phone,phone);
  add(id+'-formatted',country,' ('+phone.slice(0,3)+') '+phone.slice(3,6)+'-'+phone.slice(6)+' ',phone);
  add(id+'-wrong-country',country,'+49'+phone);
  add(id+'-double-plus',country,'+'+country+phone);
  add(id+'-repeated-prefix',country,country+country+phone);
  add(id+'-letters',country,phone+'x');
 }
 add('cn-unallocated-prefix','+86','141'+cn.slice(3));
 add('cn-fixed-line','+86','10'+String(randomInt(10000000,99999999)));
 add('cn-international-without-plus','+86','86'+cn,cn);
 add('jp-international-without-plus','+81','81'+jp,jp);
 add('jp-national-trunk','+81','0'+jp,jp);
 add('jp-fixed-line','+81','3'+String(randomInt(10000000,99999999)));
 add('jp-metadata-mobile-60','+81','60'+jp.slice(2),'60'+jp.slice(2));
 add('sg-fixed-line','+65','612'+sg.slice(3));
 add('sg-unallocated-prefix','+65','800'+sg.slice(3));
 add('us-unallocated-area','+1','211'+us.slice(3));
 add('us-toll-free','+1','800'+us.slice(3));
 add('us-leading-one','+1','1'+us,us);
 add('us-canadian-hybrid','+1','41655501'+us.slice(-2),'41655501'+us.slice(-2));
 add('gb-national-trunk','+44','0'+gb,gb);
 add('gb-fixed-line','+44','20794600'+us.slice(-2));
 add('unknown-calling-code','+999',jp);
 add('non-geographic-toll-free','+800',sg);
 add('empty-phone','+86','');
 return cases;
};
