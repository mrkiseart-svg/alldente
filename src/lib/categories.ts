import type {Category} from '@/types';
export function categoryFor(name:string):Category{
 const n=name.toLowerCase();
 if(n.trim()==='куриный бульон') return 'Другое';
 if(/суп|бульон/.test(n)) return 'Супы';
 if(/пицц|лазан|барилл|болоньез|такос|начос|рагу|салат/.test(n)) return /начос|салат/.test(n)?'Закуски':'Основные блюда';
 if(/пломбир|морожен|тирамису|чизкейк/.test(n)) return 'Десерты';
 if(/сок|морс|лимонад/.test(n)) return 'Напитки';
 if(/тигр|эликсир|огонь|дракон|туман|буря|мангуст/.test(n)) return 'Коктейли';
 return 'Другое';
}
