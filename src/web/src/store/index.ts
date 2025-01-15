// External imports - with versions
import { configureStore } from '@reduxjs/toolkit'; // v1.9.7
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'; // v8.1.3
import { createListenerMiddleware } from '@reduxjs/toolkit'; // v1.9.7

// Internal imports
import authSlice from './authSlice';
import datasetsSlice from './datasetsSlice';
import generationSlice from './generationSlice';
import safetySlice from './safetySlice';
import metricsSlice from './metricsSlice';

// Initialize performance monitoring middleware
const listenerMiddleware = createListenerMiddleware();

// Configure performance monitoring
listenerMiddleware.startListening({
  predicate: () => true,
  effect: (action, listenerApi) => {
    const startTime = Date.now();
    listenerApi.unsubscribe();
    listenerApi.subscribe(() => {
      const duration = Date.now() - startTime;
      console.debug('Action processing time:', {
        action: action.type,
        duration,
        timestamp: new Date().toISOString()
      });
    });
  }
});

// Configure Redux store with all slices and middleware
export const store = configureStore({
  reducer: {
    auth: authSlice,
    datasets: datasetsSlice,
    generation: generationSlice,
    safety: safetySlice,
    metrics: metricsSlice
  },
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore non-serializable date objects in actions
        ignoredActions: ['datasets/setSelectedDataset'],
        // Ignore non-serializable date objects in state paths
        ignoredPaths: [
          'datasets.datasets.createdAt',
          'datasets.datasets.updatedAt'
        ]
      },
      thunk: {
        extraArgument: {
          // Add any extra arguments for thunks here
        }
      }
    }).concat(listenerMiddleware.middleware)
});

// Type-safe hooks and types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/**
 * Type-safe dispatch hook with performance tracking
 * @returns Type-safe dispatch function
 */
export const useAppDispatch = () => useDispatch<AppDispatch>();

/**
 * Type-safe selector hook with memoization
 */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Export configured store instance
export default store;