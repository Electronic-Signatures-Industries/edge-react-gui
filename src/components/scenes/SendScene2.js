// @flow

import { bns } from 'biggystring'
import { Scene } from 'edge-components'
import type { EdgeCurrencyInfo, EdgeCurrencyWallet, EdgeParsedUri, EdgeSpendTarget } from 'edge-core-js'
import * as React from 'react'
import { ScrollView, View } from 'react-native'
import { Actions } from 'react-native-router-flux'
import { connect } from 'react-redux'
import { sprintf } from 'sprintf-js'

import { reset, sendConfirmationUpdateTx } from '../../actions/SendConfirmationActions.js'
import { FIO_ADDRESS_LIST } from '../../constants/SceneKeys'
import { FIO_STR } from '../../constants/WalletAndCurrencyConstants'
import s from '../../locales/strings.js'
import { getDisplayDenomination } from '../../modules/Settings/selectors.js'
import { Slider } from '../../modules/UI/components/Slider/Slider.ui'
import { convertCurrencyFromExchangeRates, convertNativeToExchangeRateDenomination } from '../../modules/UI/selectors.js'
import { type GuiMakeSpendInfo } from '../../reducers/scenes/SendConfirmationReducer.js'
import { type Dispatch, type RootState } from '../../types/reduxTypes.js'
import type { GuiContact, GuiWallet } from '../../types/types.js'
import * as UTILS from '../../util/utils.js'
import { SceneWrapper } from '../common/SceneWrapper.js'
import { ButtonsModal } from '../modals/ButtonsModal'
import { FlipInputModal } from '../modals/FlipInputModal.js'
import type { WalletListResult } from '../modals/WalletListModal'
import { WalletListModal } from '../modals/WalletListModal'
import { Airship, showError } from '../services/AirshipInstance.js'
import { type Theme, type ThemeProps, cacheStyles, withTheme } from '../services/ThemeContext.js'
import { AddressTile } from '../themed/AddressTile.js'
import { EdgeText } from '../themed/EdgeText'
import { Tile } from '../themed/Tile.js'

export const SEND_ACTION_TYPE = {
  send: 'send',
  fioTransferDomain: 'fioTransferDomain'
}

type OwnProps = {
  amount?: string,
  walletId?: string,
  actionType: 'send' | 'fioTransferDomain',
  fioDomain?: string,
  fioWallet?: EdgeCurrencyWallet
}

type StateProps = {
  contacts: GuiContact[],
  currencyCode: string,
  currencyInfo?: EdgeCurrencyInfo,
  balanceFiatAmount: number,
  balanceCrypto: string,
  feeSyntax: string,
  feeSyntaxStyle?: string,
  guiWallet: GuiWallet,
  coreWallet: EdgeCurrencyWallet | null,
  wallets: { string: GuiWallet }
}

type DispatchProps = {
  onSelectWallet(walletId: string, currencyCode: string): void,
  reset: () => void,
  sendConfirmationUpdateTx: (guiMakeSpendInfo: GuiMakeSpendInfo) => Promise<void> // Somehow has a return??
}

type RouteProps = {
  allowedCurrencyCodes?: string[],
  guiMakeSpendInfo?: GuiMakeSpendInfo
}

type Props = OwnProps & StateProps & DispatchProps & RouteProps & ThemeProps

type State = {
  recipientAddress: string,
  clipboard: string,
  loading: boolean,
  showSlider: boolean
}

class SendComponent extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      recipientAddress: '',
      clipboard: '',
      loading: false,
      showSlider: true
    }
  }

  componentDidMount(): void {
    if (this.props.actionType === SEND_ACTION_TYPE.fioTransferDomain) {
      this.props.onSelectWallet(this.props.guiWallet.id, FIO_STR)
    }

    if (this.props.guiMakeSpendInfo) {
      this.props.sendConfirmationUpdateTx(this.props.guiMakeSpendInfo)
    }
  }

  componentWillUnmount() {
    this.props.reset()
    if (this.props.guiMakeSpendInfo && this.props.guiMakeSpendInfo.onBack) {
      this.props.guiMakeSpendInfo.onBack()
    }
  }

  resetSlider = (): void => {
    this.setState({ showSlider: false }, () => this.setState({ showSlider: true }))
  }

  handleWalletPress = () => {
    Airship.show(bridge => <WalletListModal bridge={bridge} headerTitle={s.strings.fio_src_wallet} allowedCurrencyCodes={this.props.allowedCurrencyCodes} />)
      .then(({ walletId, currencyCode }: WalletListResult) => {
        if (walletId && currencyCode) {
          this.props.onSelectWallet(walletId, currencyCode)
        }
      })
      .catch(error => console.log(error))
  }

  onChangeAddress = async (guiMakeSpendInfo: GuiMakeSpendInfo, parsedUri?: EdgeParsedUri) => {
    const { actionType, sendConfirmationUpdateTx } = this.props
    const { spendTargets } = guiMakeSpendInfo
    const recipientAddress = parsedUri ? parsedUri.publicAddress : spendTargets && spendTargets[0].publicAddress ? spendTargets[0].publicAddress : ''

    if (actionType === SEND_ACTION_TYPE.fioTransferDomain) {
      if (recipientAddress && recipientAddress.indexOf('FIO') < 0) {
        showError(s.strings.scan_invalid_address_error_title)
        return
      }
    }

    if (actionType === SEND_ACTION_TYPE.send) {
      if (parsedUri) {
        const nativeAmount = parsedUri.nativeAmount || '0'
        const spendTargets: EdgeSpendTarget[] = [
          {
            publicAddress: parsedUri.publicAddress,
            nativeAmount
          }
        ]
        guiMakeSpendInfo = {
          spendTargets,
          lockInputs: false,
          metadata: parsedUri.metadata,
          uniqueIdentifier: parsedUri.uniqueIdentifier,
          nativeAmount,
          ...guiMakeSpendInfo
        }
      }
      sendConfirmationUpdateTx(guiMakeSpendInfo)
    }
    this.setState({ recipientAddress })
  }

  submit = async () => {
    const { actionType, amount } = this.props
    const { recipientAddress } = this.state
    this.setState({ loading: true })

    if (actionType === SEND_ACTION_TYPE.fioTransferDomain) {
      const { fioDomain, fioWallet } = this.props
      if (!fioWallet || !fioDomain) return showError(s.strings.fio_wallet_missing_for_fio_domain)
      try {
        await fioWallet.otherMethods.fioAction('transferFioDomain', { fioDomain, newOwnerKey: recipientAddress, maxFee: amount })

        const { theme } = this.props
        const styles = getStyles(theme)
        const domainName = `@${fioDomain || ''}`
        const transferredMessage = ` ${s.strings.fio_domain_transferred.toLowerCase()}`
        await Airship.show(bridge => (
          <ButtonsModal
            bridge={bridge}
            title={s.strings.fio_domain_label}
            buttons={{
              ok: { label: s.strings.string_ok_cap }
            }}
          >
            <EdgeText style={styles.tileTextBottom}>
              <EdgeText style={styles.cursive}>{domainName}</EdgeText>
              {transferredMessage}
            </EdgeText>
          </ButtonsModal>
        ))
        return Actions.popTo(FIO_ADDRESS_LIST)
      } catch (e) {
        showError(sprintf(s.strings.fio_transfer_err_msg, s.strings.fio_domain_label))
        this.resetSlider()
      }
    }

    this.setState({ loading: false })
  }

  handleFlipinputModal = () => {
    Airship.show(bridge => <FlipInputModal bridge={bridge} walletId={this.props.guiWallet.id} currencyCode={this.props.currencyCode} />).catch(error =>
      console.log(error)
    )
  }

  renderAmount() {
    const { actionType } = this.props

    if (actionType === SEND_ACTION_TYPE.fioTransferDomain) {
      return null
    }
    return <Tile type="touchable" title={s.strings.fio_request_amount} onPress={this.handleFlipinputModal} />
  }

  renderAdditionalTiles() {
    const { actionType } = this.props

    if (actionType === SEND_ACTION_TYPE.fioTransferDomain) {
      return this.props.fioDomain && <Tile type="static" title={s.strings.fio_domain_to_transfer} body={`@${this.props.fioDomain}`} />
    }
  }

  // Render
  render() {
    const { actionType, coreWallet, currencyCode, feeSyntax, feeSyntaxStyle, guiWallet, theme } = this.props
    const { loading, recipientAddress, showSlider } = this.state
    const styles = getStyles(theme)
    const sliderDisabled = !recipientAddress
    const walletName = `${guiWallet.name} (${guiWallet.currencyCode})`

    return (
      <SceneWrapper background="theme">
        <ScrollView>
          <View style={styles.tilesContainer}>
            <Tile
              type={actionType === SEND_ACTION_TYPE.fioTransferDomain ? 'static' : 'editable'}
              title={`${s.strings.step} 1: ${s.strings.select_wallet}`}
              onPress={this.handleWalletPress}
              body={walletName}
            />
            {coreWallet && (
              <AddressTile
                title={`${s.strings.step} 2: ${s.strings.transaction_details_recipient} ${s.strings.fragment_send_address}`}
                recipientAddress={recipientAddress}
                coreWallet={coreWallet}
                currencyCode={currencyCode}
                onChangeAddress={this.onChangeAddress}
              />
            )}
            {this.renderAmount()}
            <Tile type="static" title={`${s.strings.string_fee}:`}>
              <EdgeText style={{ color: feeSyntaxStyle ? theme[feeSyntaxStyle] : theme.primaryText }}>{feeSyntax}</EdgeText>
            </Tile>
            {this.renderAdditionalTiles()}
          </View>
          <Scene.Footer style={styles.footer}>
            {showSlider && <Slider onSlidingComplete={this.submit} sliderDisabled={sliderDisabled} showSpinner={loading} />}
          </Scene.Footer>
        </ScrollView>
      </SceneWrapper>
    )
  }
}

const getStyles = cacheStyles((theme: Theme) => ({
  tilesContainer: {
    flex: 1,
    width: '100%',
    flexDirection: 'column'
  },
  tileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: theme.rem(0.25)
  },
  tileTextBottom: {
    color: theme.primaryText,
    fontSize: theme.rem(1)
  },
  tileTextPrice: {
    marginRight: theme.rem(0.25),
    color: theme.primaryText,
    fontSize: theme.rem(1)
  },
  tileTextPriceFiat: {
    color: theme.primaryText,
    fontSize: theme.rem(0.75)
  },
  footer: {
    marginTop: theme.rem(0.75),
    marginHorizontal: theme.rem(2)
  },
  cursive: {
    color: theme.primaryText,
    fontStyle: 'italic'
  }
}))

export const SendScene2 = connect(
  (state: RootState, ownProps: OwnProps): StateProps => {
    const walletId = ownProps.walletId || state.ui.wallets.selectedWalletId
    const wallets = state.ui.wallets.byId
    const guiWallet = wallets[walletId]
    const currencyCode = ownProps.walletId ? guiWallet.currencyCode : state.ui.wallets.selectedCurrencyCode
    const { fiatCurrencyCode, isoFiatCurrencyCode } = guiWallet
    const { contacts, exchangeRates, ui } = state
    const { settings } = ui
    const { plugins } = settings
    const { allCurrencyInfos } = plugins
    const currencyInfo = UTILS.getCurrencyInfo(allCurrencyInfos, currencyCode)

    // balance
    const balanceInCrypto = guiWallet.nativeBalances[currencyCode]
    const balanceCrypto = convertNativeToExchangeRateDenomination(settings, currencyCode, balanceInCrypto)
    const balanceFiatAmount = convertCurrencyFromExchangeRates(exchangeRates, currencyCode, isoFiatCurrencyCode, parseFloat(balanceCrypto))

    const { account } = state.core
    const { currencyWallets } = account

    // Fees
    let feeSyntax = ''
    let feeSyntaxStyle
    if (ownProps.actionType === SEND_ACTION_TYPE.fioTransferDomain) {
      const primaryExchangeDenomination = getDisplayDenomination(state, currencyCode)
      const secondaryDisplayDenomination = UTILS.getDenomFromIsoCode(fiatCurrencyCode)
      const nativeAmount = ownProps.amount ? bns.abs(`${ownProps.amount}`) : ''
      const cryptoAmount = convertNativeToExchangeRateDenomination(settings, currencyCode, nativeAmount)
      const currentFiatAmount = convertCurrencyFromExchangeRates(exchangeRates, currencyCode, isoFiatCurrencyCode, parseFloat(cryptoAmount))
      feeSyntax = `${primaryExchangeDenomination.symbol || ''} ${cryptoAmount} (${secondaryDisplayDenomination.symbol || ''} ${currentFiatAmount.toFixed(2)})`
    } else if (ownProps.actionType === SEND_ACTION_TYPE.send) {
      const transactionFee = UTILS.calculateTransactionFee(state, guiWallet, currencyCode)
      feeSyntax = `${transactionFee.cryptoSymbol || ''} ${transactionFee.cryptoAmount} (${transactionFee.fiatSymbol || ''} ${transactionFee.fiatAmount})`
      feeSyntaxStyle = transactionFee.fiatStyle
    }

    return {
      contacts,
      currencyCode,
      currencyInfo,
      balanceFiatAmount,
      balanceCrypto,
      coreWallet: currencyWallets ? currencyWallets[walletId] : null,
      feeSyntax,
      feeSyntaxStyle,
      guiWallet,
      wallets
    }
  },
  (dispatch: Dispatch): DispatchProps => ({
    onSelectWallet: (walletId: string, currencyCode: string) => {
      dispatch({ type: 'UI/WALLETS/SELECT_WALLET', data: { currencyCode: currencyCode, walletId: walletId } })
    },
    reset: () => dispatch(reset()),
    sendConfirmationUpdateTx: (guiMakeSpendInfo: GuiMakeSpendInfo) => dispatch(sendConfirmationUpdateTx(guiMakeSpendInfo))
  })
)(withTheme(SendComponent))