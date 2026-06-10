import React, { createContext, useContext } from 'react';

type AuthCtx = { signOut: () => void; userId: string; isPro: boolean };

const AuthContext = createContext<AuthCtx>({ signOut: () => {}, userId: '', isPro: false });

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
