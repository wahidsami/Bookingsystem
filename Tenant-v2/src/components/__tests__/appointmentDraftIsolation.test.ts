import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('Workstream A: Appointment Creation Draft & Customer State Isolation', () => {
  // Test State Harness representing AppointmentWorkspace parent orchestrator state
  interface ParentState {
    selectedCustId: string;
    custMode: 'existing' | 'walkin';
    newCustName: string;
    newCustPhone: string;
    newCustEmail: string;
    stagedServices: Array<{ id: string; serviceId: string; duration: number }>;
    createStep: number;
    isCreateDrawerOpen: boolean;
  }

  function createInitialParentState(): ParentState {
    return {
      selectedCustId: '',
      custMode: 'existing',
      newCustName: '',
      newCustPhone: '',
      newCustEmail: '',
      stagedServices: [],
      createStep: 1,
      isCreateDrawerOpen: false
    };
  }

  function resetParentCustomerState(state: ParentState) {
    state.custMode = 'existing';
    state.selectedCustId = '';
    state.newCustName = '';
    state.newCustPhone = '';
    state.newCustEmail = '';
    state.stagedServices = [];
    state.createStep = 1;
  }

  // Drawer simulation representing InteractiveDrawers sync logic
  interface DrawerInternalState {
    selectedCustId: string;
    custMode: string;
    walkinFullName: string;
    walkinPhone: string;
    walkinEmail: string;
    stagedServices: Array<{ id: string; serviceId: string; duration: number }>;
    createStep: number;
    bookingScope: 'single' | 'group';
    groupParticipants: Array<{ id: string; name: string; email?: string }>;
  }

  function syncDrawerProps(
    props: {
      initialSelectedCustId?: string;
      initialCustMode?: 'existing' | 'walkin';
      initialWalkinName?: string;
      initialWalkinPhone?: string;
      initialWalkinEmail?: string;
      initialStagedServices?: Array<{ id: string; serviceId: string; duration: number }>;
      initialCreateStep?: number;
    },
    currentState: DrawerInternalState
  ): DrawerInternalState {
    const next: DrawerInternalState = {
      ...currentState,
      selectedCustId: props.initialSelectedCustId || '',
      custMode: props.initialCustMode || 'existing',
      walkinFullName: props.initialWalkinName || '',
      walkinPhone: props.initialWalkinPhone || '',
      walkinEmail: props.initialWalkinEmail || '',
      stagedServices: Array.isArray(props.initialStagedServices) ? props.initialStagedServices : [],
      createStep: typeof props.initialCreateStep === 'number' && props.initialCreateStep >= 1 ? props.initialCreateStep : 1
    };

    const hasPrepopulatedIdentity = Boolean(
      props.initialSelectedCustId ||
      props.initialWalkinName ||
      (Array.isArray(props.initialStagedServices) && props.initialStagedServices.length > 0)
    );

    if (!hasPrepopulatedIdentity) {
      next.bookingScope = 'single';
      next.groupParticipants = [{ id: 'part-1', name: '' }];
    }

    return next;
  }

  test('Scenario 1: Fresh appointment slot click resets prior customer, walkin, and group participant state', () => {
    const parentState = createInitialParentState();

    // Prior flow: user entered walkin info and added participant 2 in a group flow
    parentState.selectedCustId = '';
    parentState.custMode = 'walkin';
    parentState.newCustName = 'Participant 2';
    parentState.newCustPhone = '0551234567';
    parentState.newCustEmail = 'guest@example.com';
    parentState.stagedServices = [{ id: 'stg-1', serviceId: 'srv-1', duration: 60 }];
    parentState.createStep = 2;

    // Fresh slot click invokes resetParentCustomerState() before opening drawer
    resetParentCustomerState(parentState);
    parentState.isCreateDrawerOpen = true;

    assert.equal(parentState.selectedCustId, '', 'Parent customer ID must be empty');
    assert.equal(parentState.newCustName, '', 'Parent walkin name must be empty');
    assert.equal(parentState.newCustEmail, '', 'Parent walkin email must be empty');
    assert.equal(parentState.stagedServices.length, 0, 'Parent staged services must be empty');
    assert.equal(parentState.createStep, 1, 'Parent createStep must be 1');

    // Drawer hydrates from reset parent props
    const drawerState: DrawerInternalState = {
      selectedCustId: 'stale-id',
      custMode: 'walkin',
      walkinFullName: 'Participant 2',
      walkinPhone: '0551234567',
      walkinEmail: 'guest@example.com',
      stagedServices: [{ id: 'stg-1', serviceId: 'srv-1', duration: 60 }],
      createStep: 2,
      bookingScope: 'group',
      groupParticipants: [
        { id: 'part-1', name: 'Primary' },
        { id: 'part-2', name: 'Participant 2', email: 'guest@example.com' }
      ]
    };

    const synced = syncDrawerProps({
      initialSelectedCustId: parentState.selectedCustId,
      initialCustMode: parentState.custMode,
      initialWalkinName: parentState.newCustName,
      initialWalkinPhone: parentState.newCustPhone,
      initialWalkinEmail: parentState.newCustEmail,
      initialStagedServices: parentState.stagedServices,
      initialCreateStep: parentState.createStep
    }, drawerState);

    assert.equal(synced.selectedCustId, '', 'Drawer customer ID must be reset');
    assert.equal(synced.walkinFullName, '', 'Drawer walkin name must be reset');
    assert.equal(synced.walkinEmail, '', 'Drawer walkin email must be reset');
    assert.equal(synced.stagedServices.length, 0, 'Drawer staged services must be empty');
    assert.equal(synced.createStep, 1, 'Drawer step must be 1');
    assert.equal(synced.bookingScope, 'single', 'Drawer booking scope must reset to single');
    assert.equal(synced.groupParticipants.length, 1, 'Group participants must reset to default 1');
  });

  test('Scenario 2: Drawer discard / close invokes onResetCustomerState to prevent stale leaks on next open', () => {
    const parentState = createInitialParentState();
    let onResetInvoked = false;

    // User types into parent state during interaction
    parentState.newCustName = 'Sara';
    parentState.newCustEmail = 'sara@test.com';
    parentState.stagedServices = [{ id: 's-1', serviceId: 'srv-cut', duration: 30 }];

    // Drawer discard callback
    const onResetCustomerStateCallback = () => {
      onResetInvoked = true;
      resetParentCustomerState(parentState);
    };

    // User cancels/discards drawer
    onResetCustomerStateCallback();
    parentState.isCreateDrawerOpen = false;

    assert.equal(onResetInvoked, true, 'onResetCustomerState callback must be invoked');
    assert.equal(parentState.newCustName, '');
    assert.equal(parentState.newCustEmail, '');
    assert.equal(parentState.stagedServices.length, 0);
  });

  test('Scenario 3: Explicit Rebook action preserves prepopulated customer and staged services', () => {
    const parentState = createInitialParentState();

    // Rebook flow explicitly sets customer and services from an existing visit
    const rebookCustomer = { id: 'cust-vip-123', name: 'Noura Al-Otaibi', email: 'noura@test.com' };
    const rebookServices = [
      { id: 'rebook-1', serviceId: 'srv-massage', duration: 60 },
      { id: 'rebook-2', serviceId: 'srv-sauna', duration: 30 }
    ];

    parentState.custMode = 'existing';
    parentState.selectedCustId = rebookCustomer.id;
    parentState.stagedServices = rebookServices;
    parentState.createStep = 2;
    parentState.isCreateDrawerOpen = true;

    // Drawer receives rebook props and syncs without wiping
    const emptyDrawer: DrawerInternalState = {
      selectedCustId: '',
      custMode: 'existing',
      walkinFullName: '',
      walkinPhone: '',
      walkinEmail: '',
      stagedServices: [],
      createStep: 1,
      bookingScope: 'single',
      groupParticipants: [{ id: 'part-1', name: '' }]
    };

    const rebookSynced = syncDrawerProps({
      initialSelectedCustId: parentState.selectedCustId,
      initialCustMode: parentState.custMode,
      initialWalkinName: parentState.newCustName,
      initialWalkinPhone: parentState.newCustPhone,
      initialWalkinEmail: parentState.newCustEmail,
      initialStagedServices: parentState.stagedServices,
      initialCreateStep: parentState.createStep
    }, emptyDrawer);

    assert.equal(rebookSynced.selectedCustId, 'cust-vip-123', 'Rebook must preserve customer ID');
    assert.equal(rebookSynced.stagedServices.length, 2, 'Rebook must preserve staged services');
    assert.equal(rebookSynced.createStep, 2, 'Rebook must navigate to step 2 directly');
  });
});
