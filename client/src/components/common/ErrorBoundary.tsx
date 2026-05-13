import React, { Component, PropsWithChildren, ErrorInfo } from 'react';

interface ErrorBoundaryProps extends PropsWithChildren {
  level?: 'page' | 'section' | 'component';
  resetOnPropsChange?: boolean;
  resetKeys?: string[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  prevResetKeys?: string[];
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, prevResetKeys: props.resetKeys };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState
  ): Partial<ErrorBoundaryState> | null {
    if (
      props.resetOnPropsChange &&
      props.resetKeys &&
      state.prevResetKeys &&
      props.resetKeys.some((k, i) => k !== state.prevResetKeys![i])
    ) {
      return { hasError: false, error: undefined, prevResetKeys: props.resetKeys };
    }
    return null;
  }
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Что-то пошло не так</h2>
          <button onClick={() => window.location.reload()}>
            Перезагрузить страницу
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}