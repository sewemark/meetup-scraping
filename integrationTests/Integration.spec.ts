const chakram = require('chakram');
const expect = chakram.expect;

export { }

describe('Meetup sra api tests', function () {
    const baseAddress = 'http://localhost:3000';
    this.timeout(20000);
    it('should retrun response for proper credentials', async () => {
        const response = await chakram.post(`${baseAddress}/scrape`, {
            username: 'sewerynjakub.markowicz@gmail.com',
            password: 'zenek123',
        }, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        expect(response).to.have.status(200);
        return chakram.wait();
    });

    it('should retrun 400 for invalid credentials', async () => {
        const response = await chakram.post(`${baseAddress}/scrape`, {
            username: 'invalid@gamil.com',
            password: 'invalidPassword',
        }, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        expect(response).to.have.status(400);
        return chakram.wait();
    });
});
