const expect = chai.expect;

describe('API 服務核心功能測試 (API Service)', () => {

    describe('距離計算功能 (calculateDistance)', () => {
        it('若座標缺失應回傳 null', () => {
            expect(calculateDistance(null, 121, 25, 121)).to.be.null;
            expect(calculateDistance(25, null, 25, 121)).to.be.null;
        });

        it('應能準確計算兩點間距離 (誤差範圍 0.1km)', () => {
            // 台北101 到 市政府 (~0.8-0.9 km)
            const lat1 = 25.033964, lng1 = 121.564472;
            const lat2 = 25.041187, lng2 = 121.565196;
            const dist = calculateDistance(lat1, lng1, lat2, lng2);

            expect(dist).to.be.a('number');
            expect(dist).to.be.closeTo(0.8, 0.1); // approx 0.8km
        });

        it('相同地點距離應為 0', () => {
            expect(calculateDistance(25, 121, 25, 121)).to.equal(0);
        });
    });

    describe('假日判斷功能 (checkIsHoliday) [Mock測試]', () => {
        let originalFetch;

        before(() => {
            originalFetch = window.fetch;
        });

        after(() => {
            window.fetch = originalFetch;
        });

        it('API失敗時，應將「週日」視為假日 (Weekend Fallback)', async () => {
            // Mock fetch failure to force fallback
            window.fetch = async () => { throw new Error('API Fail'); };

            const sunday = new Date('2026-01-18T12:00:00'); // Sunday
            const isHoliday = await checkIsHoliday(sunday);
            expect(isHoliday).to.be.true;
        });

        it('API失敗時，應將「週一」視為平日 (Weekend Fallback)', async () => {
            window.fetch = async () => { throw new Error('API Fail'); };

            const monday = new Date('2026-01-19T12:00:00'); // Monday
            const isHoliday = await checkIsHoliday(monday);
            expect(isHoliday).to.be.false;
        });

        it('應優先使用 API 回傳的假日資料 (Mock API)', async () => {
            // Mock API response
            window.fetch = async (url) => {
                return {
                    ok: true,
                    json: async () => [
                        { date: '20260101', isHoliday: true, name: '元旦' }, // Mock Data
                        { date: '20260120', isHoliday: false }
                    ]
                };
            };

            const date1 = new Date('2026-01-01T12:00:00');
            expect(await checkIsHoliday(date1)).to.be.true;
        });
    });

});
