'use client'

import React from 'react'
import { Button } from "./ui/button"

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** When this key changes, the boundary automatically resets its error state */
  resetKey?: string | number
}

interface ErrorBoundaryState {
  hasError: boolean
  lastResetKey?: string | number
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, lastResetKey: props.resetKey }
  }

  static getDerivedStateFromError(_: Error): Partial<ErrorBoundaryState> {
    return { hasError: true }
  }

  /** Auto-reset when resetKey changes (e.g. navigating to a different document) */
  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState
  ): Partial<ErrorBoundaryState> | null {
    if (state.hasError && props.resetKey !== state.lastResetKey) {
      return { hasError: false, lastResetKey: props.resetKey }
    }
    if (props.resetKey !== state.lastResetKey) {
      return { lastResetKey: props.resetKey }
    }
    return null
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen">
          <h2 className="text-2xl font-bold mb-4">Oops, there was an error!</h2>
          <Button onClick={() => this.setState({ hasError: false })}>
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}



