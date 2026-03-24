import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestore-errors';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // Create default profile for new user
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              role: 'admin', // First user is admin by default in this demo logic
              permissions: ['all'],
              createdAt: new Date().toISOString()
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUp = async (email: string, pass: string, name: string, phone: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(userCredential.user, { displayName: name });
    
    const newProfile: UserProfile = {
      uid: userCredential.user.uid,
      email,
      displayName: name,
      phoneNumber: phone,
      role: 'admin',
      permissions: ['all'],
      createdAt: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'users', userCredential.user.uid), newProfile);
    setProfile(newProfile);
    return userCredential.user;
  };

  const signIn = async (email: string, pass: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    return userCredential.user;
  };

  const signOut = () => firebaseSignOut(auth);

  return { user, profile, loading, signUp, signIn, signOut };
};
