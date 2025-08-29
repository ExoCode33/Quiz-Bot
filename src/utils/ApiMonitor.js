// src/utils/ApiMonitor.js

class ApiMonitor {
    constructor() {
        this.stats = new Map();
        this.resetStats();
    }

    resetStats() {
        this.stats.clear();
        this.globalStats = {
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            totalQuestions: 0,
            totalValidQuestions: 0,
            startTime: Date.now()
        };
    }

    recordApiCall(apiName, success, questionCount = 0, validQuestionCount = 0, responseTime = 0, error = null) {
        // Update global stats
        this.globalStats.totalCalls++;
        if (success) {
            this.globalStats.successfulCalls++;
            this.globalStats.totalQuestions += questionCount;
            this.globalStats.totalValidQuestions += validQuestionCount;
        } else {
            this.globalStats.failedCalls++;
        }

        // Update per-API stats
        if (!this.stats.has(apiName)) {
            this.stats.set(apiName, {
                calls: 0,
                successes: 0,
                failures: 0,
                totalQuestions: 0,
                totalValidQuestions: 0,
                totalResponseTime: 0,
                averageResponseTime: 0,
                errors: [],
                lastSuccess: null,
                lastFailure: null
            });
        }

        const apiStats = this.stats.get(apiName);
        apiStats.calls++;
        apiStats.totalResponseTime += responseTime;
        apiStats.averageResponseTime = apiStats.totalResponseTime / apiStats.calls;

        if (success) {
            apiStats.successes++;
            apiStats.totalQuestions += questionCount;
            apiStats.totalValidQuestions += validQuestionCount;
            apiStats.lastSuccess = new Date();
        } else {
            apiStats.failures++;
            apiStats.lastFailure = new Date();
            if (error) {
                apiStats.errors.push({
                    error: error.message,
                    timestamp: new Date()
                });
                // Keep only last 5 errors
                if (apiStats.errors.length > 5) {
                    apiStats.errors.shift();
                }
            }
        }
    }

    getApiHealth(apiName) {
        const stats = this.stats.get(apiName);
        if (!stats) return 'Unknown';

        const successRate = stats.calls > 0 ? (stats.successes / stats.calls) * 100 : 0;
        const validationRate = stats.totalQuestions > 0 ? (stats.totalValidQuestions / stats.totalQuestions) * 100 : 0;

        if (successRate >= 90 && validationRate >= 70) return 'Excellent';
        if (successRate >= 70 && validationRate >= 50) return 'Good';
        if (successRate >= 50 && validationRate >= 30) return 'Fair';
        return 'Poor';
    }

    generateReport() {
        const runtime = Date.now() - this.globalStats.startTime;
        const runtimeMinutes = Math.floor(runtime / 60000);
        const runtimeSeconds = Math.floor((runtime % 60000) / 1000);

        let report = '\n' + '='.repeat(60) + '\n';
        report += '📊 API PERFORMANCE REPORT\n';
        report += '='.repeat(60) + '\n';
        report += `⏱️  Runtime: ${runtimeMinutes}m ${runtimeSeconds}s\n`;
        report += `📞 Total API Calls: ${this.globalStats.totalCalls}\n`;
        report += `✅ Successful: ${this.globalStats.successfulCalls} (${((this.globalStats.successfulCalls / this.globalStats.totalCalls) * 100).toFixed(1)}%)\n`;
        report += `❌ Failed: ${this.globalStats.failedCalls} (${((this.globalStats.failedCalls / this.globalStats.totalCalls) * 100).toFixed(1)}%)\n`;
        report += `📚 Total Questions: ${this.globalStats.totalQuestions}\n`;
        report += `✅ Valid Questions: ${this.globalStats.totalValidQuestions} (${this.globalStats.totalQuestions > 0 ? ((this.globalStats.totalValidQuestions / this.globalStats.totalQuestions) * 100).toFixed(1) : 0}%)\n`;
        report += '\n' + '-'.repeat(60) + '\n';
        report += 'PER-API BREAKDOWN:\n';
        report += '-'.repeat(60) + '\n';

        for (const [apiName, stats] of this.stats.entries()) {
            const successRate = stats.calls > 0 ? ((stats.successes / stats.calls) * 100).toFixed(1) : '0.0';
            const validationRate = stats.totalQuestions > 0 ? ((stats.totalValidQuestions / stats.totalQuestions) * 100).toFixed(1) : '0.0';
            const health = this.getApiHealth(apiName);
            const healthIcon = health === 'Excellent' ? '🟢' : health === 'Good' ? '🟡' : health === 'Fair' ? '🟠' : '🔴';

            report += `\n${healthIcon} ${apiName.padEnd(20)} | Health: ${health}\n`;
            report += `   📞 Calls: ${stats.calls} (✅ ${stats.successes}, ❌ ${stats.failures})\n`;
            report += `   📊 Success Rate: ${successRate}%\n`;
            report += `   📚 Questions: ${stats.totalQuestions} total, ${stats.totalValidQuestions} valid (${validationRate}%)\n`;
            report += `   ⏱️  Avg Response: ${stats.averageResponseTime.toFixed(0)}ms\n`;
            
            if (stats.lastSuccess) {
                report += `   ✅ Last Success: ${stats.lastSuccess.toLocaleTimeString()}\n`;
            }
            if (stats.lastFailure) {
                report += `   ❌ Last Failure: ${stats.lastFailure.toLocaleTimeString()}\n`;
            }
            if (stats.errors.length > 0) {
                report += `   🚫 Recent Errors: ${stats.errors[stats.errors.length - 1].error}\n`;
            }
        }

        report += '\n' + '='.repeat(60) + '\n';
        return report;
    }

    getQuickStats() {
        const successRate = this.globalStats.totalCalls > 0 ? 
            ((this.globalStats.successfulCalls / this.globalStats.totalCalls) * 100).toFixed(1) : '0.0';
        const validationRate = this.globalStats.totalQuestions > 0 ? 
            ((this.globalStats.totalValidQuestions / this.globalStats.totalQuestions) * 100).toFixed(1) : '0.0';

        return {
            totalCalls: this.globalStats.totalCalls,
            successRate: parseFloat(successRate),
            validationRate: parseFloat(validationRate),
            totalValidQuestions: this.globalStats.totalValidQuestions
        };
    }

    getRecommendations() {
        const recommendations = [];
        const stats = this.getQuickStats();

        if (stats.successRate < 50) {
            recommendations.push('🚨 High API failure rate detected. Consider adding more fallback questions.');
        }

        if (stats.validationRate < 30) {
            recommendations.push('⚠️ Low question validation rate. Review anime content filters.');
        }

        if (stats.totalValidQuestions < 5) {
            recommendations.push('📚 Very few valid questions obtained. Expand fallback question pool.');
        }

        for (const [apiName, apiStats] of this.stats.entries()) {
            const apiSuccessRate = apiStats.calls > 0 ? (apiStats.successes / apiStats.calls) * 100 : 0;
            
            if (apiSuccessRate < 20 && apiStats.calls > 2) {
                recommendations.push(`🔴 ${apiName} is consistently failing. Consider removing or fixing.`);
            }
            
            if (apiStats.averageResponseTime > 5000) {
                recommendations.push(`⏰ ${apiName} has slow response times. Consider increasing timeout.`);
            }
        }

        if (recommendations.length === 0) {
            recommendations.push('✅ API performance looks good!');
        }

        return recommendations;
    }

    logSummary() {
        console.log(this.generateReport());
        
        const recommendations = this.getRecommendations();
        if (recommendations.length > 0) {
            console.log('\n📋 RECOMMENDATIONS:');
            recommendations.forEach(rec => console.log(`   ${rec}`));
        }
    }
}

module.exports = ApiMonitor;
