import React, {Component} from 'react'
import {
  ActivityIndicator,
  TextInput,
  View,
  TouchableHighlight,
  TouchableOpacity
} from 'react-native'
import Permissions from 'react-native-permissions'
import Contacts from 'react-native-contacts'
import {setContactList} from '../../contacts/action'
import T from '../../components/FormattedText'
import {connect} from 'react-redux'
import FAIcon from 'react-native-vector-icons/FontAwesome'
import MAIcon from 'react-native-vector-icons/MaterialIcons'
import Ionicon from 'react-native-vector-icons/Ionicons'
import SimpleLineIcons from 'react-native-vector-icons/SimpleLineIcons'
import LinearGradient from 'react-native-linear-gradient'
import {Actions} from 'react-native-router-flux'
import styles from './style'
import SortableListView from 'react-native-sortable-listview'
import SortableList from 'react-native-sortable-list'
import WalletListRow from './WalletListRow.ui'
import strings from '../../../../locales/default'
import {sprintf} from 'sprintf-js'
import {
  toggleArchiveVisibility,
  updateRenameWalletInput,
  closeWalletDeleteModal,
  closeRenameWalletModal,
  renameWallet,
  deleteWallet,
  updateActiveWalletsOrder,
  updateArchivedWalletsOrder
} from './action'
import * as CORE_SELECTORS from '../../../Core/selectors.js'
import {border as b} from '../../../utils'
import {colors as c} from '../../../../theme/variables/airbitz.js'
import StylizedModal from '../../components/Modal/Modal.ui'
import * as UI_SELECTORS from '../../selectors.js'

class WalletList extends Component {
  toggleArchiveDropdown = () => {
    this.props.dispatch(toggleArchiveVisibility())
  }

  componentDidMount () {
    console.log('in WalletList->componentDidMount')
    Permissions.getPermissionStatus('contacts').then((response) => {
      if (response === 'authorized') {
        Contacts.getAll((err, contacts) => {
          if (err === 'denied') {
            // error
          } else {
            contacts.sort((a, b) => {
              return a.givenName > b.givenName
            })
            this.props.dispatch(setContactList(contacts))
          }
        })
      }
    })
  }

  render () {
    const {wallets} = this.props
    return (
      <View style={styles.container}>
        {this.renderDeleteWalletModal()}
        {this.renderRenameWalletModal()}

        <View style={[styles.totalBalanceBox]}>
          <View style={[styles.totalBalanceWrap]}>
            <View style={[styles.totalBalanceHeader, b()]}>
              <T style={[styles.totalBalanceText]}>
                {sprintf(strings.enUS['fragment_wallets_balance_text'])}
              </T>
            </View>
            <View style={[styles.currentBalanceBoxDollarsWrap, b()]}>
              <T style={[styles.currentBalanceBoxDollars]}>
                $ {this.tallyUpTotalCrypto()}
                {/* {this.props.settings.defaultFiat} */}
              </T>
            </View>
          </View>
        </View>

        <View style={styles.walletsBox}>
          <LinearGradient start={{
            x: 0,
            y: 0
          }} end={{
            x: 1,
            y: 0
          }} style={[styles.walletsBoxHeaderWrap]} colors={[c.gradient.light, c.gradient.dark]}>
            <View style={[styles.walletsBoxHeaderTextWrap, b()]}>
              <View style={styles.leftArea}>
                <SimpleLineIcons name='wallet' style={[styles.walletIcon, b()]} color='white' />
                <T style={styles.walletsBoxHeaderText}>
                  {sprintf(strings.enUS['fragment_wallets_header'])}
                </T>
              </View>
            </View>

            <TouchableOpacity style={[styles.walletsBoxHeaderAddWallet, b(), {width: 35}]}
              onPress={() => Actions.createWallet()}>
              <Ionicon name='md-add' style={[styles.dropdownIcon, b()]} color='white' />
            </TouchableOpacity>
          </LinearGradient>
          {Object.keys(wallets).length > 0
            ? this.renderActiveSortableList(wallets, this.sortActiveWallets(this.props.wallets), sprintf(strings.enUS['fragmet_wallets_list_archive_title_capitalized']), this.renderActiveRow, this.onActiveRowMoved)
            : <ActivityIndicator style={{flex: 1, alignSelf: 'center'}} size={'large'} />}
        </View>
      </View>
    )
  }

  renderActiveSortableList = (datum, order, label, renderRow, onRowMoved) => {
    let data = {}
    for (var props in datum) {
      data[datum[props].sortIndex] = datum[props]
    }
    if (order) {
      return (
        <View style={[{flex: 1, flexDirection: 'column'}]}>
          <SortableList
            rowActivationTime={20}
            style={[styles.sortableWalletList, {flexDirection: 'row'}]}
            contentContainerStyle={[styles.sortableWalletList]}
            data={data}
            render={label}
            onRowMoved={this.onActiveRowMoved}
            renderRow={this.renderActiveRow}
          />
        </View>
      )
    }
  }

  renderArchivedSortableList = (data, order, label, renderRow, onRowMoved) => {
    if (order) {
      return (
        <SortableListView
          style={styles.sortableWalletList}
          data={data}
          order={order}
          render={label}
          onRowMoved={this.onArchivedRowMoved}
          renderRow={renderRow}
        />
      )
    }
  }

  renderActiveRow = (data, active) => {
    return <WalletListRow active={active} data={data.data} archiveLabel={sprintf(strings.enUS['fragmet_wallets_list_archive_title_capitalized'])} />
  }

  renderArchivedRow = data => {
    return <WalletListRow data={data} archiveLabel={sprintf(strings.enUS['fragmet_wallets_list_restore_title_capitalized'])} />
  }

  sortActiveWallets = (wallets) => {
    let activeOrdered = Object.keys(wallets).filter(key => {
      return !wallets[key].archived
    }) // filter out archived wallets
    .sort((a, b) => {
      return wallets[a].sortIndex - wallets[b].sortIndex
    }) // sort them according to their (previous) sortIndices
    return activeOrdered
  }

  onActiveRowMoved = action => {
    const wallets = this.props.wallets
    const activeOrderedWallets = Object.keys(wallets).filter(key => {
      return !wallets[key].archived
    }) // filter out archived wallets
    .sort((a, b) => {
      return wallets[a].sortIndex - wallets[b].sortIndex
    }) // sort them according to their (previous) sortIndices
    const order = activeOrderedWallets
    const newOrder = this.getNewOrder(order, action) // pass the old order to getNewOrder with the action ( from, to, and  )

    this.props.dispatch(updateActiveWalletsOrder(newOrder))
    this.forceUpdate()
  }

  onArchivedRowMoved = action => {
    const wallets = this.props.wallets
    const activeOrderedWallets = Object.keys(wallets).filter(key => {
      return wallets[key].archived
    }).sort((a, b) => {
      return wallets[a].sortIndex - wallets[b].sortIndex
    })
    const order = activeOrderedWallets
    const newOrder = this.getNewOrder(order, action)

    this.props.dispatch(updateArchivedWalletsOrder(newOrder))
    this.forceUpdate()
  }

  getNewOrder = (order, action) => {
    const {to, from} = action
    const newOrder = [].concat(order)
    newOrder.splice(to, 0, newOrder.splice(from, 1)[0])

    return newOrder
  }

  renderDeleteWalletModal = () => {
    return <StylizedModal featuredIcon={< DeleteIcon />} headerText='fragment_wallets_delete_wallet' // t(')
      modalMiddle={< DeleteSubtext />} modalBottom={< DeleteWalletButtonsConnect />}
      visibilityBoolean={this.props.deleteWalletModalVisible} />
  }

  renderRenameWalletModal = () => {
    return <StylizedModal featuredIcon={< AddressIcon />} headerText='fragment_wallets_rename_wallet'
      headerSubtext={this.props.walletName} modalMiddle={< WalletNameInputConnect />}
      modalBottom={< RenameWalletButtonsConnect />} walletId={this.props.walletId}
      visibilityBoolean={this.props.renameWalletModalVisible} />
  }

  tallyUpTotalCrypto = () => {
    const temporaryTotalCrypto = {}
    for (var parentProp in this.props.wallets) {
      for (var balanceProp in this.props.wallets[parentProp].balances) {
        if (!temporaryTotalCrypto[balanceProp]) {
          temporaryTotalCrypto[balanceProp] = 0
        }
        if (!isNaN(this.props.wallets[parentProp].balances[balanceProp])) {
          // now to divide the amount by its multiplier
          var denomMultiplier = this.props.wallets[parentProp].allDenominations[balanceProp][this.props.settings[balanceProp].denomination].multiplier
          temporaryTotalCrypto[balanceProp] += (this.props.wallets[parentProp].balances[balanceProp] / denomMultiplier)
        }
      }
    }
    let totalBalance = this.calculateTotalBalance(temporaryTotalCrypto)
    return totalBalance
  }

  calculateTotalBalance = (values) => {
    var total = 0
    for (var currency in values) {
      let addValue = this.props.currencyConverter.convertCurrency(currency, this.props.settings.defaultISOFiat, values[currency])
      total += addValue
    }
    return total.toFixed(2)
  }

}

WalletList.propTypes = {}

const mapStateToProps = (state) => {
  const currencyConverter = CORE_SELECTORS.getCurrencyConverter(state)

  return {
    // updatingBalance: state.ui.scenes.transactionList.updatingBalance,
    coreWallets: state.core.wallets.byId,
    wallets: state.ui.wallets.byId,
    activeWalletIds: UI_SELECTORS.getActiveWalletIds(state),
    archivedWalletIds: UI_SELECTORS.getArchivedWalletIds(state),
    walletArchivesVisible: state.ui.scenes.walletList.walletArchivesVisible,
    renameWalletModalVisible: state.ui.scenes.walletList.renameWalletModalVisible,
    deleteWalletModalVisible: state.ui.scenes.walletList.deleteWalletModalVisible,
    walletName: state.ui.scenes.walletList.walletName,
    walletId: state.ui.scenes.walletList.walletId,
    walletOrder: state.ui.wallets.walletListOrder,
    settings: state.ui.settings,
    currencyConverter
  }
}

const mapDispatchToProps = dispatch => ({
  updateActiveWalletsOrder: activeWalletIds => {
    dispatch(updateActiveWalletsOrder(activeWalletIds))
  },
  updateArchivedWalletsOrder: archivedWalletIds => {
    dispatch(updateArchivedWalletsOrder(archivedWalletIds))
  }
})

export default connect((mapStateToProps), (mapDispatchToProps))(WalletList)

// //// Beginning of Delete Area ////////

class DeleteIcon extends Component {
  render () {
    return <FAIcon name='trash-o' size={24} color={c.primary} style={[{
      position: 'relative',
      top: 12,
      left: 14,
      height: 24,
      width: 24,
      backgroundColor: 'transparent',
      zIndex: 1015,
      elevation: 1015
    }]} />
  }
}

class DeleteSubtext extends Component {
  render () {
    return (
      <T style={styles.subHeaderSyntax}>
        {sprintf(strings.enUS['fragmet_wallets_delete_wallet_first_confirm_message_mobile'])}
        {(this.props.currentWalletBeingDeleted)
          ? <T style={{fontWeight: 'bold'}}>
            {this.props.currentWalletBeingDeleted}?
            </T>
          : <T>{sprintf(strings.enUS['fragment_wallets_this_wallet'])}</T>}
      </T>
    )
  }
}
export const DeleteSubtextConnect = connect(state => ({
  currentWalletBeingDeleted: state.ui.scenes.walletList.currentWalletBeingDeleted
}))(DeleteSubtext)

class DeleteWalletButtons extends Component {
  _onCancelDeleteModal = () => {
    this.props.dispatch(closeWalletDeleteModal())
  }

  _onDeleteModalDone = () => {
    this.props.dispatch(deleteWallet(this.props.walletId))
  }

  render () {
    return (
      <View style={[styles.buttonsWrap, b()]}>

        <TouchableHighlight onPress={this._onCancelDeleteModal} style={[styles.cancelButtonWrap, styles.stylizedButton]}>

          <View style={styles.stylizedButtonTextWrap}>
            <T style={[styles.cancelButton, styles.stylizedButtonText]}>{sprintf(strings.enUS['string_cancel_cap'])}</T>
          </View>

        </TouchableHighlight>

        <TouchableHighlight onPress={this._onDeleteModalDone} style={[styles.doneButtonWrap, styles.stylizedButton]}>

          <View style={styles.stylizedButtonTextWrap}>
            <T style={[styles.doneButton, styles.stylizedButtonText]}>{sprintf(strings.enUS['string_delete'])}</T>
          </View>

        </TouchableHighlight>
      </View>
    )
  }
}
export const DeleteWalletButtonsConnect = connect(state => ({}))(DeleteWalletButtons)

// ///////End of Delete Area //////////

// ///// Beginning of Rename Area ////////

class AddressIcon extends Component {
  render () {
    return <MAIcon name='edit' size={24} color={c.primary} style={[{
      position: 'relative',
      top: 12,
      left: 14,
      height: 24,
      width: 24,
      backgroundColor: 'transparent'
    }]} />
  }
}

class WalletNameInput extends Component {

  _onNameInputChange = (input) => {
    // be aware that walletListRowOptions.ui.js also initially dispatches this action
    this.props.dispatch(updateRenameWalletInput(input))
  }

  render () {
    return (
      <View style={[styles.nameInputWrap, b()]}>
        <TextInput style={[styles.nameInput, b()]}
          onChangeText={(input) => this._onNameInputChange(input)}
          defaultValue={this.props.currentWalletBeingRenamed} autoFocus />
      </View>
    )
  }
}
export const WalletNameInputConnect = connect(state => ({
  currentWalletBeingRenamed: state.ui.scenes.walletList.walletName,
  // /currentWalletRename:       state.ui.scenes.walletList.currentWalletRename,
  renameWalletVisible: state.ui.scenes.walletList.renameWalletVisible,
  renameWalletInput: state.ui.scenes.walletList.renameWalletInput
}))(WalletNameInput)

class RenameWalletButtons extends Component {
  constructor (props) {
    super(props)
    this.state = {}
  }

  _onRenameModalDone = () => {
    this.props.dispatch(closeRenameWalletModal())
    this.props.dispatch(renameWallet(this.props.walletId, this.props.renameWalletInput))
  }

  _onCancelRenameModal = () => {
    this.props.dispatch(closeRenameWalletModal())
    this.props.dispatch(updateRenameWalletInput(''))
  }

  render () {
    return (
      <View style={[styles.buttonsWrap, b()]}>

        <TouchableHighlight onPress={this._onCancelRenameModal} style={[styles.cancelButtonWrap, styles.stylizedButton]}>

          <View style={styles.stylizedButtonTextWrap}>
            <T style={[styles.cancelButton, styles.stylizedButtonText]}>{sprintf(strings.enUS['string_cancel_cap'])}</T>
          </View>

        </TouchableHighlight>

        <TouchableHighlight onPress={this._onRenameModalDone} style={[styles.doneButtonWrap, styles.stylizedButton]}>

          <View style={styles.stylizedButtonTextWrap}>
            <T style={[styles.doneButton, styles.stylizedButtonText]}>{sprintf(strings.enUS['calculator_done'])}</T>
          </View>

        </TouchableHighlight>
      </View>
    )
  }
}
export const RenameWalletButtonsConnect = connect(state => ({
  currentWalletBeingRenamed: state.ui.wallets.byId[state.ui.wallets.selectedWalletId],
  walletId: state.ui.scenes.walletList.walletId,
  renameWalletInput: state.ui.scenes.walletList.renameWalletInput
}))(RenameWalletButtons)

// ///// End of Rename Area ////////
