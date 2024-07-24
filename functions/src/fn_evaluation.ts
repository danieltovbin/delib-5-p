import { logger } from "firebase-functions/v1";
import { db } from "./index";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
    Collections,
    Evaluation,
    Evaluator,
    QuestionStage,
    ResultsBy,
    SimpleStatement,
    Statement,
    StatementSchema,
    StatementType,
    User,
    getStatementSubscriptionId,
    statementToSimpleStatement,
} from "delib-npm";
import { z } from "zod";


export async function newEvaluation(event: any) {
    try {
        //add evaluator to statement

        const statementEvaluation = event.data.data() as Evaluation;
        const { statementId, evaluation } = statementEvaluation;
        if (!statementId) throw new Error("statementId is not defined");

        //add one evaluator to statement, and add evaluation to statement
        const statement = await _updateStatementEvaluation({ statementId, evaluation, previousEvaluation: undefined, evaluationDiff: statementEvaluation.evaluation, addEvaluator: 1 });
        if (!statement) throw new Error("statement does not exist");
        updateParentStatementWithChildResults(statement.parentId);

        //update evaluators that the statement was evaluated
        const evaluator: User | undefined = statementEvaluation.evaluator;
        if (!evaluator) throw new Error("evaluator is not defined");
        const evaluatorData = await getEvaluatorData(evaluator, statement);
        if (!evaluatorData) throw new Error("evaluatorData is not defined");

        await updateStatementMetaDataAndEvaluator(evaluator, evaluatorData, statement);


        return;



    } catch (error) {
        logger.error(error);
        return;
    }

    function getUpdatedFields(statement: Statement, isFirstTime: boolean, evaluator?: Evaluator) {

        const update = { lastUpdate: Timestamp.now().toMillis() }
        //@ts-ignore
        if (isFirstTime) update.numberOfEvaluators = FieldValue.increment(1);
        //@ts-ignore
        if (statement.questionSettings?.currentStage === QuestionStage.suggestion && !evaluator?.suggested) update.numberOfFirstSuggesters = FieldValue.increment(1);
        //@ts-ignore
        if (statement.questionSettings?.currentStage === QuestionStage.firstEvaluation && !evaluator?.firstEvaluation) update.numberOfFirstEvaluators = FieldValue.increment(1);
        //@ts-ignore
        if (statement.questionSettings?.currentStage === QuestionStage.secondEvaluation && !evaluator?.secondEvaluation) update.numberOfSecondEvaluators = FieldValue.increment(1);
        console.log(evaluator)
        console.log(update)
        return update;
    }

    async function getEvaluatorData(evaluator: User, statement: Statement): Promise<Evaluator | undefined> {
        try {
            const evaluationId = getStatementSubscriptionId(statement.parentId, evaluator);
            if (!evaluationId) throw new Error("evaluationId is not defined");
            const evaluatorRef = db.collection(Collections.evaluators).doc(evaluationId);
            const evaluatorDB = await evaluatorRef.get();
            const evaluatorData = evaluatorDB.data() as Evaluator;
            if (!evaluatorData) throw new Error("evaluatorData was not found");
            return evaluatorData;
        } catch (error) {
            logger.error(error);
            return undefined;
        }
    }

    async function updateStatementMetaDataAndEvaluator(evaluator: User, evaluatorData: Evaluator | undefined, statement: Statement) {
        try {
            const evaluationId = getStatementSubscriptionId(statement.parentId, evaluator);
            if (!evaluationId) throw new Error("evaluationId is not defined");
            const evaluatorRef = db.collection(Collections.evaluators).doc(evaluationId);

            if (!evaluatorData) {
                console.log("evaluator does not exist")
                await evaluatorRef.set({ statementId: statement.parentId, evaluated: true, evaluatorId: evaluator.uid });

                const update = getUpdatedFields(statement, true);
                await db.collection(Collections.statementsMetaData).doc(statement.parentId).update(update);
            } else {

                console.log("evaluator exists")
                const update = getUpdatedFields(statement, false, evaluatorData);
                await db.collection(Collections.statementsMetaData).doc(statement.parentId).update(update);
            }

            const evaluatorUpdate: Evaluator = { evaluated: true };
            if (statement.questionSettings?.currentStage === QuestionStage.suggestion) evaluatorUpdate.suggested = true;
            if (statement.questionSettings?.currentStage === QuestionStage.firstEvaluation) evaluatorUpdate.firstEvaluation = true;
            if (statement.questionSettings?.currentStage === QuestionStage.secondEvaluation) evaluatorUpdate.secondEvaluation = true;

            await evaluatorRef.update(evaluatorUpdate);
        } catch (error) {
            logger.error(error);


        }
    }
}




export async function deleteEvaluation(event: any) {
    try {
        //add evaluator to statement
        const statementEvaluation = event.data.data() as Evaluation;
        const { statementId, evaluation } = statementEvaluation;
        if (!statementId) throw new Error("statementId is not defined");



        //add one evaluator to statement
        const statement = await _updateStatementEvaluation({ statementId, evaluationDiff: (-1 * evaluation), addEvaluator: -1 });
        if (!statement) throw new Error("statement does not exist");
        updateParentStatementWithChildResults(statement.parentId);

    } catch (error) {
        logger.error(error);
    }
}


//update evaluation of a statement
export async function updateEvaluation(event: any) {
    try {

        const statementEvaluationBefore = event.data.before.data() as Evaluation;
        const { evaluation: evaluationBefore } = statementEvaluationBefore;
        const statementEvaluationAfter = event.data.after.data() as Evaluation;
        const { evaluation: evaluationAfter, statementId } = statementEvaluationAfter;
        const evaluationDiff = evaluationAfter - evaluationBefore;

        if (!statementId) throw new Error("statementId is not defined");

        //get statement
        const statement = await _updateStatementEvaluation({ statementId, evaluationDiff });
        if (!statement) throw new Error("statement does not exist");

        //update parent statement?
        updateParentStatementWithChildResults(statement.parentId);
    } catch (error) {
        console.info("error in updateEvaluation");
        logger.error(error);

        return;
    }
}

//inner functions

function calcAgreement(newSumEvaluations: number, numberOfEvaluators: number): number {
    // agreement calculations (social choice theory)
    // The aim of the consensus calculation is to give statement with more positive evaluation and less negative evaluations,
    // while letting small groups with higher consensus an upper hand, over large groups with a lot of negative evaluations.
    try {
        z.number().parse(newSumEvaluations);
        z.number().parse(numberOfEvaluators);


        if (numberOfEvaluators === 0) throw new Error("numberOfEvaluators is 0");
        const averageEvaluation = newSumEvaluations / numberOfEvaluators; // average evaluation
        const agreement = averageEvaluation * Math.sqrt(numberOfEvaluators)
        //TODO: divide by the number of question members to get a scale of 100% agreement

        return agreement;
    } catch (error) {
        logger.error(error);
        return 0;
    }
}

interface UpdateStatementEvaluation {
    statementId: string;
    evaluationDiff: number;
    addEvaluator?: number;
    evaluation: number;
    previousEvaluation: number | undefined;
}

async function _updateStatementEvaluation({ statementId, evaluationDiff, addEvaluator = 0, evaluation = 0, previousEvaluation = undefined }: UpdateStatementEvaluation): Promise<Statement | undefined> {
    try {

        if (!statementId) throw new Error("statementId is not defined");
        const { success } = z.number().safeParse(evaluationDiff);
        if (!success) throw new Error("evaluation is not a number, or evaluation is missing");

        const _statement: Statement = await db.runTransaction(async (transaction) => {
            const statementRef = db.collection(Collections.statements).doc(statementId);
            const statementDB = await transaction.get(statementRef);
            const statement = statementDB.data() as Statement;

            //for legacy peruses, we need to parse the statement to the new schema
            if (!statement.evaluation) {

                statement.evaluation = { agreement: statement.consensus || 0, sumEvaluations: evaluationDiff, numberOfEvaluators: statement.totalEvaluators || 1 };
                await transaction.update(statementRef, { evaluation: statement.evaluation });
            } else {
                statement.evaluation.sumEvaluations += evaluationDiff;
                statement.evaluation.numberOfEvaluators += addEvaluator;
            }

            StatementSchema.parse(statement);
            const newSumEvaluations = statement.evaluation.sumEvaluations;
            const newNumberOfEvaluators = statement.evaluation.numberOfEvaluators;

            const agreement = calcAgreement(newSumEvaluations, newNumberOfEvaluators);
            statement.evaluation.agreement = agreement;
            statement.consensus = agreement;

            const updateObj: any = {
                totalEvaluators: FieldValue.increment(addEvaluator),
                consensus: agreement,
                evaluation: statement.evaluation
            }


            if (previousEvaluation !== undefined) { //in case of new evaluation
                if (evaluation > 0) {
                    updateObj.sumPro = FieldValue.increment(evaluation);
                } else if (evaluation < 0) {
                    updateObj.sumCon = FieldValue.increment(evaluation);
                }
            } else if (previousEvaluation && evaluation) { //in case of update evaluation
                if (previousEvaluation > 0 && evaluation > 0) { //in case of change in positive evaluation
                    updateObj.sumPro = FieldValue.increment(evaluation - previousEvaluation);
                } else if (previousEvaluation < 0 && evaluation < 0) { //in case of change in negative evaluation
                    updateObj.sumCon = FieldValue.increment(evaluation - previousEvaluation);
                } else {
                    updateObj.sumPro = FieldValue.increment(evaluation);
                    updateObj.sumCon = FieldValue.increment(previousEvaluation);
                }
            }


            await transaction.update(statementRef, updateObj);

            const _st = await statementRef.get();
            return _st.data() as Statement;
        });

        return _statement as Statement;


    } catch (error) {
        logger.error(error);
        return undefined;
    }
}




interface ResultsSettings {
    resultsBy: ResultsBy;
    numberOfResults?: number;
    deep?: number;
    minConsensus?: number;
    solutions?: SimpleStatement[];
}



function getResultsSettings(
    results: ResultsSettings | undefined,
): ResultsSettings {
    if (!results) {
        return {
            resultsBy: ResultsBy.topOptions,
        };
    } else {
        return results;
    }
}

async function updateParentStatementWithChildResults(
    parentId: string | undefined,
) {
    try {
        if (!parentId) throw new Error("parentId is not defined");

        //get parent statement
        const parentStatementRef = db.collection("statements").doc(parentId);
        const parentStatementDB = await parentStatementRef.get();

        if (!parentStatementDB.exists)
            throw new Error("parentStatement does not exist");

        const parentStatement = parentStatementDB.data() as Statement;

        //get results settings
        const { resultsSettings } = parentStatement;
        let { resultsBy, numberOfResults } =
            getResultsSettings(resultsSettings);

        if (numberOfResults === undefined) numberOfResults = 1;
        if (resultsBy === undefined) resultsBy = ResultsBy.topOptions;

        //this function is responsible for converting the results of evaluation of options

        if (resultsBy !== ResultsBy.topOptions) {
            //remove it when other evaluation methods will be added
            //topVote will be calculated in the votes function
            return;
        }

        const allOptionsStatementsRef = db
            .collection(Collections.statements)
            .where("parentId", "==", parentId)
            .where("statementType", "in", [
                StatementType.option,
                StatementType.result,
            ]);

        const topOptionsStatementsRef = allOptionsStatementsRef
            .orderBy("consensus", "desc") //TODO: in the future (1st aug 2024), this will be changed to evaluation.agreement
            .limit(numberOfResults);


        //get all options of the parent statement and convert them to either result, or an option
        const topOptionsStatementsDB = await topOptionsStatementsRef.get();
        const topOptionsStatements = topOptionsStatementsDB.docs.map(
            (doc: any) => doc.data() as Statement,
        );

        const childIds = topOptionsStatements.map(
            (st: Statement) => st.statementId,
        );

        const optionsDB = await allOptionsStatementsRef.get();

        await optionsDB.forEach(async (stDB: any) => {
            const st = stDB.data() as Statement;

            //update child statement selected to be of type result
            if (childIds.includes(st.statementId)) {
                db.collection(Collections.statements)
                    .doc(st.statementId)
                    .update({ statementType: StatementType.result });
            } else if (st.statementType === StatementType.result) {
                db.collection(Collections.statements)
                    .doc(st.statementId)
                    .update({ statementType: StatementType.option });
            }
        });

        await updateParentChildren(topOptionsStatements, numberOfResults);

        //update child statement selected to be of type result
    } catch (error) {
        logger.error(error);
    }

    async function updateParentChildren(
        topOptionsStatements: Statement[],
        numberOfResults: number | undefined,
    ) {
        const childStatementsSimple = topOptionsStatements.map(
            (st: Statement) => statementToSimpleStatement(st),
        );

        if (!parentId) throw new Error("parentId is not defined");

        //update parent with results
        await db.collection(Collections.statements).doc(parentId).update({
            totalResults: numberOfResults,
            results: childStatementsSimple,
        });
    }
}


