// Middleware disabled — route protection is handled client-side via AuthProvider
// This file is intentionally minimal to avoid blocking navigation

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(_request: NextRequest) {
    return NextResponse.next()
}

export const config = {
    matcher: [],
}
