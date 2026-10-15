import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { beforeEach } from 'node:test';

// Exercise real payroll and schedule persistence with isolated auth/database boundaries.
const mocks = {
    'next/cache': 'export const revalidatePath = (path) => globalThis.hrTest.revalidated.push(path);',
    'next/headers': `export const headers = async () => ({ get: (key) => key === 'host' ? 'uniform.example' : 'https' });
        export const cookies = () => { throw new Error('Unexpected cookies'); };`,
    '@/utils/supabase/server': `export const createClient = async () => ({ auth: { getUser: async () => ({ data: { user: globalThis.hrTest.user } }) } });
        export const createServiceClient = () => globalThis.hrTest.service;`,
    '@/lib/services/employees': `export const createEmployeeRow = async (_client, input) => globalThis.hrTest.profiles.push(input);
        export const updateEmployeeRow = async (_client, id, input) => globalThis.hrTest.profiles.push({ id, ...input });
        export const fetchEmployee = async (_client, id) => ({ id });
        export const fetchEmployeeByActivationToken = async () => null;
        export const markEmployeeActivated = async () => {};
        export const setEmployeeActivation = async () => {};
        export const setEmployeeActive = async () => {};`,
    '@/lib/email/notifications': `export const sendEmployeeInviteEmail = async () => { globalThis.hrTest.invites++; return { ok: true }; };`
};
registerHooks({ resolve(specifier, context, nextResolve) {
    if (mocks[specifier]) return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
    if (specifier.startsWith('@/')) return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
        const target = new URL(specifier, context.parentURL);
        if (!existsSync(target) && existsSync(new URL(`${target.href}.ts`))) return nextResolve(`${target.href}.ts`, context);
    }
    return nextResolve(specifier, context);
} });
const { computeEmployeePayroll, scheduledJornadaMin } = await import('../lib/services/hr-payroll.ts');
const { DEFAULT_SCHEDULE, scheduleInputError, fetchSchedule } = await import('../lib/services/hr-schedules.ts');
const { computeDaySummary } = await import('../lib/services/hr-attendance.ts');
const { createEmployeeAction, updateEmployeeAction, saveEmployeeScheduleAction } = await import('../app/(admin)/admin/rrhh/actions.ts');
const today = '2026-10-15';
const schedule = { employeeId: 'employee-1', ...DEFAULT_SCHEDULE };
const custom = { ...DEFAULT_SCHEDULE, workdays: [1, 2, 3, 4, 5, 6], startTime: '07:00', endTime: '16:00', lunchMin: 45 };
const rates = [{ employeeId: 'employee-1', hourlyRate: 2000, effectiveFrom: '2026-10-01' }];
const punch = (time, punchType, date = '2026-10-14') => ({ id: `${date}-${time}-${punchType}`, punchType, punchedAt: `${date}T${time}:00-06:00` });
const fullDay = [punch('08:00', 'in'), punch('10:00', 'break_start'), punch('10:15', 'break_end'), punch('12:00', 'lunch_start'), punch('13:00', 'lunch_end'), punch('17:00', 'out')];
const payroll = (punches = fullDay, overrides = {}) => computeEmployeePayroll({ punches, schedule, rates, leave: [], period: { kind: 'semana', start: '2026-10-12', end: '2026-10-18' }, today, ...overrides });
beforeEach(() => {
    const state = globalThis.hrTest = { user: { id: 'admin-1', email: 'ulogisticcr@gmail.com' }, profiles: [], writes: [], revalidated: [], created: [], deleted: [], invites: 0, scheduleError: null, savedSchedule: null };
    state.service = {
        auth: { admin: {
            createUser: async (input) => { state.created.push(input); return { data: { user: { id: 'employee-1' } } }; },
            deleteUser: async (id) => { state.deleted.push(id); return {}; }
        } },
        from: (table) => ({
            upsert: async (input, options) => {
                state.writes.push({ table, input, options });
                if (table === 'employee_schedules') {
                    if (state.scheduleError) return { error: state.scheduleError };
                    state.savedSchedule = input;
                }
                return { error: null };
            },
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.savedSchedule, error: null }) }) })
        })
    };
});

test('08:00–17:00 pays 9 hours including a 15-minute break and 60-minute lunch', () => {
    const result = payroll();
    assert.equal(scheduledJornadaMin(schedule), 540);
    assert.equal(result.regularMin, 540);
    assert.equal(result.grossPay, 1800000);
    assert.equal(result.overtimeMin, 0);
    assert.equal(result.overtimePay, 0);
    assert.equal(result.days[0].workedMin, 465);
    assert.equal(result.days[0].shiftMin, 540);
    assert.equal(result.days[0].paidLunchMin, 60);
    assert.equal(result.days[0].paidBreakMin, 15);
});
test('long lunch and break trigger attendance alerts without reducing pay', () => {
    const punches = [punch('08:00', 'in'), punch('09:00', 'break_start'), punch('09:45', 'break_end'), punch('12:00', 'lunch_start'), punch('14:00', 'lunch_end'), punch('17:00', 'out')];
    assert.equal(payroll(punches).regularMin, 540);
    assert.deepEqual(computeDaySummary(punches, schedule, { weekday: 3, isPast: true }).flags, ['long_break', 'long_lunch']);
});
test('time beyond the 9-hour shift is paid at 1.5 times the hourly rate', () => {
    const result = payroll([punch('07:45', 'in'), punch('18:00', 'out')]);
    assert.equal(result.regularMin, 540);
    assert.equal(result.overtimeMin, 75);
    assert.equal(result.regularPay, 1800000);
    assert.equal(result.overtimePay, 375000);
    assert.equal(result.grossPay, 2175000);
    assert.equal(result.days[0].overtimePay, 375000);
});
test('shorter shifts pay actual hours with lunch included', () => {
    const result = payroll([punch('09:00', 'in'), punch('12:00', 'lunch_start'), punch('13:00', 'lunch_end'), punch('16:00', 'out')]);
    assert.equal(result.regularMin, 420);
    assert.equal(result.grossPay, 1400000);
});
test('split shifts exclude the gap between exit and re-entry', () => {
    assert.equal(payroll([punch('08:00', 'in'), punch('11:00', 'out'), punch('13:00', 'in'), punch('17:00', 'out')]).regularMin, 420);
});
test('open days and missing entradas or final salidas remain unpaid', () => {
    for (const punches of [[punch('08:00', 'in')], [punch('17:00', 'out')], [punch('08:00', 'in'), punch('11:00', 'out'), punch('13:00', 'in')], [punch('08:00', 'in', today)]]) {
        const result = payroll(punches);
        assert.equal(result.regularMin, 0);
        assert.equal(result.grossPay, 0);
        assert.equal(result.daysPaid, 0);
        assert.ok(['incomplete', 'open'].includes(result.days[0].status));
    }
});
test('custom duration and workdays determine ordinary and overtime hours', () => {
    const shorterSchedule = payroll(fullDay, { schedule: { ...schedule, endTime: '14:00' } });
    assert.equal(shorterSchedule.regularMin, 360);
    assert.equal(shorterSchedule.overtimeMin, 180);
    assert.equal(shorterSchedule.grossPay, 2100000);
    const saturday = [punch('07:00', 'in', '2026-10-17'), punch('16:00', 'out', '2026-10-17')];
    const dayOff = payroll(saturday, { today: '2026-10-18' });
    assert.equal(dayOff.regularMin, 0);
    assert.equal(dayOff.overtimeMin, 540);
    assert.equal(dayOff.overtimePay, 2700000);
    assert.equal(dayOff.grossPay, 2700000);
    assert.equal(dayOff.daysPaid, 1);
    const scheduledSaturday = payroll(saturday, { today: '2026-10-18', schedule: custom });
    assert.equal(scheduledSaturday.regularMin, 540);
    assert.equal(scheduledSaturday.overtimeMin, 0);
    assert.equal(scheduledSaturday.grossPay, 1800000);
});
test('missing or invalid schedules use the default 9-hour shift', () => {
    assert.equal(payroll(fullDay, { schedule: null }).regularMin, 540);
    assert.equal(payroll(fullDay, { schedule: null }).usesDefaultSchedule, true);
    for (const bad of [{ ...schedule, endTime: '07:00' }, { ...schedule, workdays: [] }, { ...schedule, endTime: '25:00' }]) {
        const result = payroll(fullDay, { schedule: bad });
        assert.equal(result.regularMin, 540);
        assert.equal(result.invalidSchedule, true);
    }
});
test('rate history and cent rounding determine gross pay; missing rates preserve hours', () => {
    const result = payroll([...fullDay, punch('08:00', 'in', today), punch('17:00', 'out', today)], { rates: [...rates, { ...rates[0], hourlyRate: 2500.25, effectiveFrom: today }] });
    assert.equal(result.regularMin, 1080);
    assert.equal(result.grossPay, 4050225);
    assert.deepEqual(result.rates, [2000, 2500.25]);
    assert.equal(payroll(fullDay, { rates: [] }).grossPay, null);
    assert.equal(payroll(fullDay, { rates: [] }).regularMin, 540);
});
test('overtime rounds to cents per day and is included in totals', () => {
    const result = payroll([punch('08:00', 'in'), punch('17:01', 'out')], {
        rates: [{ ...rates[0], hourlyRate: 2500.25 }]
    });
    assert.equal(result.regularMin, 540);
    assert.equal(result.overtimeMin, 1);
    assert.equal(result.regularPay, 2250225);
    assert.equal(result.overtimePay, 6251);
    assert.equal(result.grossPay, 2256476);
    assert.equal(result.grossPay, result.days.reduce((sum, day) => sum + day.regularPay + day.overtimePay, 0));
});
test('missing rates preserve overtime hours without inventing a pay amount', () => {
    const result = payroll([punch('08:00', 'in'), punch('18:00', 'out')], { rates: [] });
    assert.equal(result.regularMin, 540);
    assert.equal(result.overtimeMin, 60);
    assert.equal(result.grossPay, null);
    assert.equal(result.overtimePay, null);
});
test('approved leave without punches is not paid or marked incomplete', () => {
    const result = payroll([], { leave: [{ kind: 'personal', startDate: '2026-10-14', endDate: '2026-10-14', status: 'approved' }] });
    assert.equal(result.leaveDays, 1);
    assert.equal(result.regularMin, 0);
    assert.deepEqual(result.incompleteDates, []);
});
test('creating a profile saves and reloads the selected schedule', async () => {
    assert.deepEqual(await createEmployeeAction({ fullName: 'Test Employee', email: 'test@example.com', schedule: custom }), {});
    assert.deepEqual(await fetchSchedule(globalThis.hrTest.service, 'employee-1'), { employeeId: 'employee-1', ...custom });
    assert.equal(globalThis.hrTest.invites, 1);
});
test('creation without an explicit schedule saves the default 9-hour shift', async () => {
    await createEmployeeAction({ fullName: 'Test Employee', email: 'test@example.com' });
    assert.equal(globalThis.hrTest.savedSchedule.start_time, '08:00');
    assert.equal(globalThis.hrTest.savedSchedule.end_time, '17:00');
});
test('profile editing saves its schedule and refreshes dependent views', async () => {
    assert.deepEqual(await updateEmployeeAction('employee-1', { fullName: 'Updated Name', schedule: custom }), {});
    assert.equal(globalThis.hrTest.savedSchedule.start_time, '07:00');
    assert.equal(globalThis.hrTest.profiles[0].fullName, 'Updated Name');
    assert.ok(globalThis.hrTest.revalidated.includes('/admin/rrhh/planilla'));
    assert.ok(globalThis.hrTest.revalidated.includes('/empleado/horas'));
});
test('malformed schedules fail before any profile or schedule writes', async () => {
    for (const bad of [{ ...custom, workdays: [] }, { ...custom, workdays: [7] }, { ...custom, startTime: '24:00' }, { ...custom, endTime: '06:00' }, { ...custom, lunchMin: -1 }, { ...custom, breakMin: 1.5 }, { ...custom, graceMin: NaN }]) {
        assert.ok(scheduleInputError(bad));
        assert.ok((await createEmployeeAction({ fullName: 'Test', email: 'test@example.com', schedule: bad })).error);
        assert.ok((await updateEmployeeAction('employee-1', { fullName: 'Test', schedule: bad })).error);
        assert.ok((await saveEmployeeScheduleAction('employee-1', bad)).error);
    }
    assert.equal(globalThis.hrTest.created.length, 0);
    assert.equal(globalThis.hrTest.profiles.length, 0);
    assert.equal(globalThis.hrTest.writes.length, 0);
});
test('failed schedule persistence rolls back creation without sending an invite', async () => {
    globalThis.hrTest.scheduleError = { message: 'schedule write failed' };
    assert.equal((await createEmployeeAction({ fullName: 'Test', email: 'test@example.com', schedule: custom })).error, 'schedule write failed');
    assert.deepEqual(globalThis.hrTest.deleted, ['employee-1']);
    assert.equal(globalThis.hrTest.invites, 0);
});
test('anonymous users and employees cannot modify profiles or schedules', async () => {
    for (const user of [null, { id: 'other', email: 'employee@example.com' }]) {
        globalThis.hrTest.user = user;
        assert.ok((await createEmployeeAction({ fullName: 'Test', email: 'test@example.com', schedule: custom })).error);
        assert.ok((await updateEmployeeAction('employee-1', { fullName: 'Test', schedule: custom })).error);
        assert.ok((await saveEmployeeScheduleAction('employee-1', custom)).error);
    }
    assert.equal(globalThis.hrTest.writes.length, 0);
    assert.equal(globalThis.hrTest.created.length, 0);
});
