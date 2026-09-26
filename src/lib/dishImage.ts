import type {Category} from '@/types';
import illustrations from './dishIllustrations.json';
/** Exact-name artwork for the shipped menu. Unknown dishes use a neutral cloche. */
export function dishImage(name:string,_category:Category){const n=name.trim().toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ');const image=(illustrations as Record<string,string>)[n];if(image)return image;if(n.includes('брускет'))return '/dishes/bruschetta.svg';if(n.includes('капрезе'))return '/dishes/caprese.svg';if(n.includes('паста')&&n.includes('кревет'))return '/dishes/shrimp-pasta.svg';return '/dishes/placeholder.svg'}
