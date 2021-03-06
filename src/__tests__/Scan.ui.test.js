// @flow
/* globals jest describe it expect */

import * as React from 'react'
import ShallowRenderer from 'react-test-renderer/shallow'

import { Scan } from '../components/scenes/ScanScene.js'

describe('Scan component', () => {
  it('should render with DENIED props', () => {
    const renderer = new ShallowRenderer()
    const props = {
      cameraPermission: 'blocked',
      torchEnabled: false,
      scanEnabled: false,
      showToWalletModal: false,
      currentWalletId: '',
      currentCurrencyCode: '',
      walletId: '',
      currencyCode: '',
      wallets: {},
      qrCodeScanned: jest.fn(),
      parseScannedUri: jest.fn(),
      toggleEnableTorch: jest.fn(),
      toggleScanToWalletListModal: jest.fn(),
      onSelectWallet: jest.fn(),
      selectFromWalletForExchange: jest.fn()
    }
    const actual = renderer.render(<Scan {...props} />)

    expect(actual).toMatchSnapshot()
  })

  it('should render with AUTHORIZED props', () => {
    const renderer = new ShallowRenderer()
    const props = {
      cameraPermission: 'granted',
      torchEnabled: false,
      scanEnabled: false,
      showToWalletModal: false,
      currentWalletId: '',
      currentCurrencyCode: '',
      walletId: '',
      currencyCode: '',
      wallets: {},
      qrCodeScanned: jest.fn(),
      parseScannedUri: jest.fn(),
      toggleEnableTorch: jest.fn(),
      toggleScanToWalletListModal: jest.fn(),
      onSelectWallet: jest.fn(),
      selectFromWalletForExchange: jest.fn()
    }
    const actual = renderer.render(<Scan {...props} />)

    expect(actual).toMatchSnapshot()
  })
})
