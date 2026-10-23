import {createContext,useContext,useEffect,useState,ReactNode} from 'react';
import {User,auth,onAuthStateChanged,signOut,refreshUser} from '../lib/auth';
const Context=createContext<any>(null);
export function AuthProvider({children}:{children:ReactNode}){
 const [user,setUser]=useState<User|null>(null); const [loading,setLoading]=useState(true);
 useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setLoading(false)}),[]);
 return <Context.Provider value={{user,isAdmin:user?.role==='admin',loading,logout:()=>signOut(auth),reloadUser:refreshUser}}>{children}</Context.Provider>;
}
export function useAuth(){return useContext(Context) as {user:User|null;isAdmin:boolean;loading:boolean;logout:()=>Promise<void>;reloadUser:()=>Promise<void>};}
