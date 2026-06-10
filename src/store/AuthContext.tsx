import React, { createContext, useContext } from 'react';

type AuthCtx = { signOut: () => void; userId: string; isPro: boolean; markFreeAnalysisDone: () => void };

const AuthContext = createContext<AuthCtx>({ signOut: () => {}, userId: '', isPro: false, markFreeAnalysisDone: () => {} });

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
