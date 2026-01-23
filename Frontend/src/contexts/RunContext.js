// 러닝 상태 관리 Context
import React, { createContext, useState, useContext } from 'react';

const RunContext = createContext();

export const useRun = () => {
  const context = useContext(RunContext);
  if (!context) {
    throw new Error('useRun must be used within RunProvider');
  }
  return context;
};

export const RunProvider = ({ children }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [locations, setLocations] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const startRun = () => {
    setIsRunning(true);
    setIsPaused(false);
    setStartTime(Date.now());
    setLocations([]);
    setElapsedTime(0);
  };

  const pauseRun = () => {
    setIsPaused(true);
  };

  const resumeRun = () => {
    setIsPaused(false);
    setStartTime(Date.now() - elapsedTime * 1000);
  };

  const stopRun = () => {
    setIsRunning(false);
    setIsPaused(false);
    setStartTime(null);
  };

  const addLocation = (location) => {
    setLocations((prev) => [...prev, location]);
  };

  const updateElapsedTime = (time) => {
    setElapsedTime(time);
  };

  const value = {
    isRunning,
    isPaused,
    locations,
    startTime,
    elapsedTime,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    addLocation,
    updateElapsedTime,
  };

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
};
