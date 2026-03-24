import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

export interface UserAction {
  id: string;
  action: string;
  details: string;
  userId: string;
  userName?: string;
  module?: string;
  timestamp: any;
}

export const logAction = async (data: Omit<UserAction, 'id' | 'timestamp'>) => {
  try {
    await addDoc(collection(db, 'logs'), {
      ...data,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error logging action:", error);
  }
};

export const getActions = (callback: (actions: UserAction[]) => void, max: number = 50) => {
  const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(max));
  return onSnapshot(q, (snapshot) => {
    const actions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as UserAction));
    callback(actions);
  });
};
