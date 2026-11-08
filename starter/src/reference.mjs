export const sectionImages={
 architecture:{author:'Tejvan Pettinger',source:'https://commons.wikimedia.org/wiki/File:Oxford_University,_Radcliffe_Camera,_a_Reading_room_of_Bodleian_library.jpg',license:'CC BY 2.0',licenseURL:'https://creativecommons.org/licenses/by/2.0'},
 library:{author:'Matthew Petroff',source:'https://commons.wikimedia.org/wiki/File:George-peabody-library.jpg',license:'CC BY-SA 3.0',licenseURL:'https://creativecommons.org/licenses/by-sa/3.0'},
 manuscript:{author:'Frederick Noronha',source:'https://commons.wikimedia.org/wiki/File:Old-books-on-the-open-access-shelves._Ataide_Municipal_Library,_Mapusa,_Goa,_India.jpg',license:'CC BY-SA 4.0',licenseURL:'https://creativecommons.org/licenses/by-sa/4.0'}
};
export function heroFor(page){if(page.dashboard)return {variant:'plain'};if(page.id==='site-home')return{variant:'signature',image:'hero'};if(page.id==='index')return{variant:'section',image:'architecture'};if(page.id==='language')return{variant:'section',image:'library'};if(page.id==='journal')return{variant:'section',image:'manuscript'};return{variant:page.hero_variant==='plain'?'plain':'compact'};}
