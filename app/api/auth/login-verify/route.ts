import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { userDB, authenticatorDB } from '@/lib/db';
import { createSession } from '@/lib/auth';

const rpID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';

export async function POST(request: NextRequest) {
  try {
    const body: AuthenticationResponseJSON = await request.json();

    const challenge = request.cookies.get('auth-challenge')?.value;
    const username = request.cookies.get('auth-username')?.value;

    if (!challenge || !username) {
      return NextResponse.json({ error: 'Authentication session expired' }, { status: 400 });
    }

    const user = userDB.findByUsername(username);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all authenticators for this user
    const userAuthenticators = authenticatorDB.findByUserId(user.id);

    if (userAuthenticators.length === 0) {
      return NextResponse.json({ error: 'No authenticators registered for this user' }, { status: 404 });
    }

    // Try to find matching authenticator by credential ID
    const credentialId = Buffer.from(body.id, 'base64url').toString('base64');
    console.log('Looking for credential:', credentialId);
    console.log('User authenticators:', userAuthenticators.map(a => a.credential_id));

    const authenticator = userAuthenticators.find(a => a.credential_id === credentialId);

    if (!authenticator) {
      // Credential ID might be in different encoding, just use the first authenticator if there's only one
      if (userAuthenticators.length === 1) {
        console.log('Using single authenticator for user');
        const singleAuth = userAuthenticators[0];

        // Get origin from request
        const origin = request.headers.get('origin') || `${request.nextUrl.protocol}//${request.nextUrl.host}`;

        console.log('Verifying authentication with counter:', singleAuth.counter);
        console.log('Expected challenge:', challenge);
        console.log('Expected origin:', origin);
        console.log('Expected RPID:', rpID);

        const verification = await verifyAuthenticationResponse({
          response: body,
          expectedChallenge: challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          credential: {
            publicKey: Buffer.from(singleAuth.credential_public_key, 'base64'),
            id: singleAuth.credential_id,
            counter: singleAuth.counter ?? 0,
          },
          requireUserVerification: false,
        });

        console.log('Verification result:', verification.verified);
        console.log('New counter:', verification.authenticationInfo.newCounter);

        if (!verification.verified) {
          console.error('Verification failed - details:', verification);
          return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
        }

        // Update counter
        console.log('Updating counter for credential:', singleAuth.credential_id, 'to', verification.authenticationInfo.newCounter);
        authenticatorDB.updateCounter(singleAuth.credential_id, verification.authenticationInfo.newCounter);

        // Create session
        await createSession(user.id, user.username);

        // Clear auth cookies
        const response = NextResponse.json({ success: true, user: { id: user.id, username: user.username } });
        response.cookies.delete('auth-challenge');
        response.cookies.delete('auth-username');

        return response;
      } else {
        return NextResponse.json({ error: 'Authenticator not found' }, { status: 404 });
      }
    }

    // Get origin from request
    const origin = request.headers.get('origin') || `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    console.log('Verifying authentication (matched) with counter:', authenticator.counter);
    console.log('Expected challenge:', challenge);
    console.log('Expected origin:', origin);
    console.log('Expected RPID:', rpID);

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        publicKey: Buffer.from(authenticator.credential_public_key, 'base64'),
        id: authenticator.credential_id,
        counter: authenticator.counter ?? 0,
      },
      requireUserVerification: false,
    });

    console.log('Verification result (matched):', verification.verified);
    console.log('New counter (matched):', verification.authenticationInfo.newCounter);

    if (!verification.verified) {
      console.error('Verification failed (matched) - details:', verification);
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
    }

    // Update counter
    console.log('Updating counter for credential:', authenticator.credential_id, 'to', verification.authenticationInfo.newCounter);
    authenticatorDB.updateCounter(authenticator.credential_id, verification.authenticationInfo.newCounter);

    // Create session
    await createSession(user.id, user.username);

    // Clear auth cookies
    const response = NextResponse.json({ success: true, user: { id: user.id, username: user.username } });
    response.cookies.delete('auth-challenge');
    response.cookies.delete('auth-username');

    return response;
  } catch (error) {
    console.error('Authentication verification error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
