import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Results, StatementType } from "delib-npm"

// Custom components
import Fav from "../../components/fav/Fav"
import MainCard from "./mainCard/MainCard"

// Firestore functions
import { logOut } from "../../../functions/db/auth"
import {
    FilterType,
    filterByStatementType,
    prompStore,
    sortStatementsByHirarrchy,
} from "./mainCont"

// Redux store
import {
    useAppDispatch,
    useAppSelector,
} from "../../../functions/hooks/reduxHooks"
import { statementsSubscriptionsSelector } from "../../../model/statements/statementsSlice"
import { setUser } from "../../../model/users/userSlice"

// Other
import { install } from "../../../main"
import ScreenFadeInOut from "../../components/animation/ScreenFadeInOut"
import { t } from "i18next"

const Main = () => {
    const navigate = useNavigate()

    const [filterState, setFilter] = useState<FilterType>(FilterType.all)

    const statements = [
        ...useAppSelector(statementsSubscriptionsSelector),
    ].sort((a, b) => b.lastUpdate - a.lastUpdate)

    const dispatch = useAppDispatch()

    //for defferd app install
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

    useEffect(() => {
        //for defferd app install
        setDeferredPrompt(install.deferredPrompt)
    }, [])

    function handleInstallApp() {
        try {
            prompStore(setDeferredPrompt)
        } catch (error) {
            console.error(error)
        }
    }

    function handleAddStatment() {
        navigate("/home/addStatment")
    }

    function handleLogout() {
        logOut()
        dispatch(setUser(null))
    }
    const resultsType = filterByStatementType(filterState)
        .types as StatementType[]
    const _statements = [...statements.map((statement) => statement.statement)]
    const _results = sortStatementsByHirarrchy(_statements)

    return (
        <ScreenFadeInOut>
            <div className="page">
                <div className="page__header">
                    <div className="page__header__title">
                        <h1>{t("Delib 5")}</h1>
                        <b>-</b>
                        <h2>{t("Creating Agreements")}</h2>
                    </div>
                    <div className="btns">
                        <button onClick={handleLogout}>
                            {t("Disconnect")}
                        </button>
                        {deferredPrompt && (
                            <button onClick={handleInstallApp}>
                                {t("Install the App")}
                            </button>
                        )}
                    </div>
                </div>
                <div className="page__main">
                    <div className="wrapper">
                        <h2>{t("Conversations")}</h2>
                       <label>{t("Show")}</label>
                        <select
                            onChange={(ev: any) => setFilter(ev.target.value)}
                        >
                            <option value={FilterType.all}>{t("All")}</option>
                            <option value={FilterType.questions}>
                                {t("Questions")}
                            </option>
                            <option value={FilterType.questionsResults}>
                                {t("Questions and Results")}
                            </option>
                            <option value={FilterType.questionsResultsOptions}>
                                {t("Questions, options and Results")}
                            </option>
                        </select>
                        {_results.map((result: Results) => (
                            <MainCard
                                key={result.top.statementId}
                                results={result}
                                resultsType={resultsType}
                            />
                        ))}
                    </div>
                </div>
                <Fav onclick={handleAddStatment} />
            </div>
        </ScreenFadeInOut>
    )
}

export default React.memo(Main)
